import { postIdentityKey, isCompliantSystemPost } from '@/lib/mergePersonaPosts.js';

/** Pause between revealing consecutive posts. */
export const POST_REVEAL_GAP_MS = 2000;
/** Must match `.post-card-shell--entering` in `src/styles/base.css`. */
export const POST_FEED_ENTER_ANIM_MS = 900;

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
 * Staggered feed reveals: each post prepended with `_feedEnter` animation.
 */
export function createPostFeedRevealQueue({
  gapMs = POST_REVEAL_GAP_MS,
  onPostsChange,
  getBaseline,
  onFirstReveal,
}) {
  const revealedKeys = new Set();
  const baselineKeys = new Set();
  const pendingKeys = new Set();
  const enterDoneKeys = new Set();
  const pending = [];
  let drainPromise = null;
  let revealSeq = 0;
  let revealedBatch = [];
  let firstRevealFired = false;

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

  const drain = async () => {
    while (pending.length > 0) {
      if (revealedBatch.length > 0) {
        await sleep(gapMs);
      }
      const raw = pending.shift();
      const key = postIdentityKey(raw);
      if (key) pendingKeys.delete(key);
      if (!key || revealedKeys.has(key)) continue;
      revealedKeys.add(key);
      revealSeq += 1;
      const feedKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `feed-${Date.now()}-${revealSeq}`;
      revealedBatch.push({
        ...stripFeedClientMeta(raw),
        _feedKey: feedKey,
        _feedRevealSeq: revealSeq,
      });
      if (!firstRevealFired) {
        firstRevealFired = true;
        onFirstReveal?.();
      }
      flushToUi();
      scheduleEnterDone(feedKey);
    }
    drainPromise = null;
  };

  return {
    markBaseline(posts) {
      markBaseline(posts);
    },
    hasRevealedKey(key) {
      return revealedKeys.has(key);
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
        const key = postIdentityKey(p);
        if (!key || revealedKeys.has(key) || pendingKeys.has(key)) continue;
        pendingKeys.add(key);
        pending.push(p);
        added = true;
      }
      if (added && !drainPromise) {
        drainPromise = drain();
      }
      return added;
    },
    async waitUntilIdle() {
      if (drainPromise) await drainPromise;
      while (pending.length > 0) {
        if (!drainPromise) drainPromise = drain();
        await drainPromise;
      }
      await sleep(POST_FEED_ENTER_ANIM_MS);
    },
    isIdle() {
      return pending.length === 0 && !drainPromise;
    },
  };
}

export function sortPostsForReveal(posts) {
  return [...(Array.isArray(posts) ? posts : [])].sort((a, b) => {
    const at = Number(a?.createdAt ?? a?.created_at ?? 0) || 0;
    const bt = Number(b?.createdAt ?? b?.created_at ?? 0) || 0;
    if (at !== bt) return at - bt;
    return 0;
  });
}

export function findUnrevealedPosts(apiPosts, revealedKeys) {
  const out = [];
  for (const p of Array.isArray(apiPosts) ? apiPosts : []) {
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
