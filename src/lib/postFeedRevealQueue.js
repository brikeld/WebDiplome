import { postIdentityKey } from '@/lib/mergePersonaPosts.js';

/** Pause between revealing consecutive posts (2–3s target). */
export const POST_REVEAL_GAP_MS = 2500;
/** Must match `.post-card-shell--entering` in `src/styles/base.css`. */
export const POST_FEED_ENTER_ANIM_MS = 700;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripFeedClientMeta(post) {
  if (!post || typeof post !== 'object') return post;
  const { _feedEnter, _feedKey, _feedRevealSeq, ...rest } = post;
  return rest;
}

/**
 * Staggered feed reveals: each post prepended with `_feedEnter` animation.
 * @param {{ gapMs?: number, onPostsChange: (personaPosts: object[]) => void, getBaseline: () => object[] }} opts
 */
export function createPostFeedRevealQueue({ gapMs = POST_REVEAL_GAP_MS, onPostsChange, getBaseline }) {
  const revealedKeys = new Set();
  const pendingKeys = new Set();
  const pending = [];
  let drainPromise = null;
  let revealSeq = 0;
  let revealedBatch = [];

  const markBaseline = (posts) => {
    revealedKeys.clear();
    for (const p of Array.isArray(posts) ? posts : []) {
      const key = postIdentityKey(p);
      if (key) revealedKeys.add(key);
    }
    revealedBatch = [];
  };

  const flushToUi = () => {
    const baseline = getBaseline() ?? [];
    const batchForProfile = revealedBatch.map((p, i) => ({
      ...p,
      _feedEnter: i === revealedBatch.length - 1,
    }));
    onPostsChange([...batchForProfile, ...baseline]);
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
      flushToUi();
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
    allPostsRevealed(posts) {
      for (const p of Array.isArray(posts) ? posts : []) {
        const key = postIdentityKey(p);
        if (key && !revealedKeys.has(key)) return false;
      }
      return true;
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
