import { postIdentityKey, isCompliantSystemPost } from '@/lib/mergePersonaPosts.js';

/** Pause between revealing consecutive posts. */
export const POST_REVEAL_GAP_MS = 2000;
/** Must match the `post-card-feed-enter` duration in `src/styles/base.css`. */
export const POST_FEED_ENTER_ANIM_MS = 480;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripFeedClientMeta(post) {
  if (!post || typeof post !== 'object') return post;
  const { _feedEnter, _feedEnterDone, _feedKey, _feedRevealSeq, ...rest } = post;
  return rest;
}

export function stripFeedRevealMetaFromPosts(posts) {
  return (Array.isArray(posts) ? posts : []).map(stripFeedClientMeta);
}

/**
 * Prepare already-on-screen posts for use as a reveal baseline: clear the
 * active-entry markers (`_feedEnter`, `_feedKey`) so they don't re-animate, but
 * KEEP `_feedRevealSeq` (and `_feedEnterDone`) so each post holds its current
 * place in the feed while new posts reveal above it.
 *
 * Using `stripFeedRevealMetaFromPosts` here instead drops the sequence, which
 * makes already-revealed posts fall back to (unreliable) createdAt order and
 * visibly sink down the feed the moment a new generation begins.
 */
export function settleFeedPostsAsBaseline(posts) {
  return (Array.isArray(posts) ? posts : []).map((post) => {
    if (!post || typeof post !== 'object') return post;
    const { _feedEnter, _feedKey, ...rest } = post;
    return rest;
  });
}

/**
 * Staggered feed reveals: each post prepended with `_feedEnter` animation.
 */
export function createPostFeedRevealQueue({
  gapMs = POST_REVEAL_GAP_MS,
  onPostsChange,
  getBaseline,
  onFirstReveal,
  onPostRevealed,
  onNextPostChange,
  beforeRevealPost = null,
  // Optional shared allocator returning a strictly increasing reveal sequence.
  // When several queues (one per author) share one allocator, `_feedRevealSeq`
  // becomes GLOBAL across authors, so the aggregated feed can order posts by the
  // true order they were revealed instead of comparing per-author counters.
  nextRevealSeq = null,
}) {
  const revealedKeys = new Set();
  const baselineKeys = new Set();
  const pendingKeys = new Set();
  const enterDoneKeys = new Set();
  const pending = [];
  let drainPromise = null;
  let localRevealSeq = 0;
  const allocRevealSeq =
    typeof nextRevealSeq === 'function'
      ? nextRevealSeq
      : () => {
          localRevealSeq += 1;
          return localRevealSeq;
        };
  let revealedBatch = [];
  let firstRevealFired = false;
  let nextPostPersona = Symbol('unset');

  const notifyNextPost = () => {
    const persona = pending[0]?.persona ?? null;
    if (Object.is(persona, nextPostPersona)) return;
    nextPostPersona = persona;
    onNextPostChange?.(persona);
  };

  const markBaseline = (posts) => {
    revealedKeys.clear();
    baselineKeys.clear();
    enterDoneKeys.clear();
    firstRevealFired = false;
    for (const p of Array.isArray(posts) ? posts : []) {
      const key = postIdentityKey(p);
      if (key) {
        revealedKeys.add(key);
        baselineKeys.add(key);
      }
    }
    revealedBatch = [];
  };

  // Each revealed post animates independently for POST_FEED_ENTER_ANIM_MS.
  // Tracking per-post `done` (via enterDoneKeys) rather than `isLatest in batch`
  // ensures every newly revealed post gets the entering class for its full
  // animation, not just the most-recent one.
  const flushToUi = () => {
    const baseline = getBaseline() ?? [];
    const batchForProfile = revealedBatch.map((p) => {
      const done = Boolean(p._feedKey && enterDoneKeys.has(p._feedKey));
      return {
        ...p,
        _feedEnter: !done,
        _feedEnterDone: done,
      };
    });
    onPostsChange([...batchForProfile, ...baseline]);
  };

  const scheduleEnterDone = (feedKey) => {
    if (!feedKey || enterDoneKeys.has(feedKey)) return;
    setTimeout(() => {
      enterDoneKeys.add(feedKey);
      flushToUi();
    }, POST_FEED_ENTER_ANIM_MS);
  };

  const drainLoop = async () => {
    while (pending.length > 0) {
      if (revealedBatch.length > 0) {
        await sleep(gapMs);
      }
      const raw = pending.shift();
      const key = postIdentityKey(raw);
      if (key) pendingKeys.delete(key);
      if (!key || revealedKeys.has(key)) {
        notifyNextPost();
        continue;
      }
      revealedKeys.add(key);
      const seq = allocRevealSeq();
      const feedKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `feed-${Date.now()}-${seq}`;
      revealedBatch.push({
        ...stripFeedClientMeta(raw),
        _feedKey: feedKey,
        _feedRevealSeq: seq,
      });
      if (!firstRevealFired) {
        firstRevealFired = true;
        onFirstReveal?.();
      }
      if (typeof beforeRevealPost === 'function') {
        try {
          await beforeRevealPost(raw);
        } catch {
          /* particle bridge must never block reveals */
        }
      }
      flushToUi();
      // Notify listeners after the post has been committed into the feed. This
      // keeps the loading persona on the post being generated until it is
      // actually posted, then advances to the next pending persona.
      try {
        onPostRevealed?.(raw?.persona ?? null);
      } catch {
        /* a flash listener must never break the reveal pipeline */
      }
      scheduleEnterDone(feedKey);
      notifyNextPost();
    }
  };

  /*
   * Start the drain loop if it isn't already running.
   *
   * CRITICAL: `drainPromise` is nulled via `.finally`, NOT inside `drainLoop`.
   * When a batch holds a single post the loop runs to completion synchronously
   * (no leading `sleep`), so a previous design that did `drainPromise = null`
   * inside the loop got that null immediately overwritten by the caller's
   * `drainPromise = drainLoop()` assignment — leaving `drainPromise` stuck
   * non-null forever. That wedged every later enqueue (`!drainPromise` was
   * never true again), so posts trickling in one-at-a-time only revealed the
   * first one and `isIdle()`/`waitUntilIdle()` never settled. `.finally` always
   * runs after the promise resolves, and the trailing re-check picks up any
   * items appended during the final synchronous window.
   */
  const ensureDrain = () => {
    if (drainPromise) return;
    drainPromise = drainLoop().finally(() => {
      drainPromise = null;
      if (pending.length > 0) ensureDrain();
    });
  };

  return {
    markBaseline(posts) {
      markBaseline(posts);
    },
    hasRevealedKey(key) {
      return revealedKeys.has(key);
    },
    hasBaselineKey(key) {
      return baselineKeys.has(key);
    },
    hasPendingKey(key) {
      return pendingKeys.has(key);
    },
    isBaselineEstablished() {
      return baselineKeys.size > 0;
    },
    findUnrevealed(posts) {
      return findUnrevealedPosts(posts, revealedKeys);
    },
    hasRevealedAll(keys) {
      const list = Array.isArray(keys) ? keys : [];
      if (list.length === 0) return true;
      return list.every((key) => revealedKeys.has(key));
    },
    allNewGeneratedRevealed(apiPosts) {
      for (const p of Array.isArray(apiPosts) ? apiPosts : []) {
        if (isCompliantSystemPost(p)) continue;
        const key = postIdentityKey(p);
        if (!key || baselineKeys.has(key)) continue;
        if (!revealedKeys.has(key)) return false;
      }
      return true;
    },
    countNewGeneratedInApi(apiPosts) {
      let count = 0;
      for (const p of Array.isArray(apiPosts) ? apiPosts : []) {
        if (isCompliantSystemPost(p)) continue;
        const key = postIdentityKey(p);
        if (!key || baselineKeys.has(key)) continue;
        count += 1;
      }
      return count;
    },
    enqueue(posts) {
      const list = Array.isArray(posts) ? posts : [];
      let added = false;
      for (const p of list) {
        if (isCompliantSystemPost(p)) continue;
        const key = postIdentityKey(p);
        if (!key || revealedKeys.has(key) || pendingKeys.has(key)) continue;
        pendingKeys.add(key);
        pending.push(p);
        added = true;
      }
      if (added) {
        notifyNextPost();
        ensureDrain();
      }
      return added;
    },
    async waitUntilIdle({ waitForEnterAnimation = true } = {}) {
      // Loop until both the queue is empty AND no drain is in flight. Each
      // awaited drain may append more work (or finish synchronously), so we
      // re-check both conditions every pass rather than awaiting once.
      while (drainPromise || pending.length > 0) {
        if (!drainPromise && pending.length > 0) ensureDrain();
        if (drainPromise) {
          await drainPromise;
        } else {
          // Yield once so a freshly-resolved drain's `.finally` can run.
          await Promise.resolve();
        }
      }
      if (waitForEnterAnimation) {
        await sleep(POST_FEED_ENTER_ANIM_MS);
      }
    },
    isIdle() {
      return pending.length === 0 && !drainPromise;
    },
  };
}

export function sortPostsForReveal(posts) {
  return [...(Array.isArray(posts) ? posts : [])].sort((a, b) => {
    const at = postRevealCreatedAtMs(a);
    const bt = postRevealCreatedAtMs(b);
    if (at !== bt) return at - bt;
    return 0;
  });
}

function postRevealCreatedAtMs(post) {
  const raw = post?.createdAt ?? post?.created_at ?? 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function findUnrevealedPosts(apiPosts, revealedKeys) {
  const out = [];
  for (const p of Array.isArray(apiPosts) ? apiPosts : []) {
    if (isCompliantSystemPost(p)) continue;
    const key = postIdentityKey(p);
    if (!key || revealedKeys.has(key)) continue;
    out.push(p);
  }
  return out;
}

export function expectedGeneratedKeysFromJobPosts(posts) {
  return (Array.isArray(posts) ? posts : [])
    .filter((p) => !isCompliantSystemPost(p))
    .map((p) => postIdentityKey(p))
    .filter(Boolean);
}
