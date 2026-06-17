import { mergePostsPrepend, postIdentityKey } from '@/lib/mergePersonaPosts.js';
import { createDemoBeforeReveal } from '@/lib/generationParticleFlight.js';
import {
  createPostFeedRevealQueue,
  POST_REVEAL_GAP_MS,
  sortPostsForReveal,
  stripFeedRevealMetaFromPosts,
} from '@/lib/postFeedRevealQueue.js';

/**
 * When the global profile directory poll picks up new posts from other users,
 * reveal them on the home feed with the same staggered enter animation.
 */
export function createFeedSpectatorRevealController({
  setAllProfiles,
  gapMs = POST_REVEAL_GAP_MS,
  onPostRevealed = null,
}) {
  const queuesBySlug = new Map();
  const baselineEstablished = new Set();
  const latestApiPostsBySlug = new Map();
  // One reveal counter shared by every author's queue, so `_feedRevealSeq` is
  // monotonic across the whole feed and posts can be ordered by the real order
  // they were revealed — not by a per-author counter that resets each author.
  let globalRevealSeq = 0;
  const nextRevealSeq = () => {
    globalRevealSeq += 1;
    return globalRevealSeq;
  };
  // Reveal order persisted by post identity. The home feed polls the directory
  // on an interval and overwrites every profile's posts with a fresh API
  // snapshot that has no `_feedRevealSeq`. Without re-applying the order, the
  // feed reverts to the stored `createdAt` order on each poll — and `createdAt`
  // is an unreliable harvest timestamp, so posts visibly jump back to the wrong
  // order until the next reveal. This map lets us re-stamp the known reveal
  // sequence onto any snapshot so the order survives polls/reloads.
  const revealSeqByKey = new Map();
  // Remember the reveal sequence each revealed post carries, so later API
  // snapshots can be re-stamped (see revealSeqByKey above). Used by both
  // spectator reveals and the owner's own-generation reveals.
  const recordRevealOrder = (posts) => {
    for (const p of Array.isArray(posts) ? posts : []) {
      const seq = Number(p?._feedRevealSeq ?? 0) || 0;
      if (seq <= 0) continue;
      const key = postIdentityKey(p);
      if (!key) continue;
      if (seq > (revealSeqByKey.get(key) ?? 0)) revealSeqByKey.set(key, seq);
    }
  };
  // A post arriving from another user descends into the feed slot and bursts,
  // then materializes — the same sphere + burst used for your own generation.
  const beforeRevealPost = createDemoBeforeReveal();
  let skipSlug = null;
  /** When set, only these profile slugs may enqueue new spectator reveals. */
  let ingestAllowSlugs = null;
  /** Demo rotate: only reveal this post identity for a slug (prevents duplicate/batch reveals). */
  const expectedRevealKeyBySlug = new Map();

  const mergeAnimatedWithApiPosts = (slugKey, queuePosts) => {
    const apiPosts = latestApiPostsBySlug.get(slugKey) ?? [];
    const animated = (Array.isArray(queuePosts) ? queuePosts : []).filter(
      (p) => p?._feedEnter || p?._feedEnterDone,
    );
    const stableApi = stripFeedRevealMetaFromPosts(apiPosts);
    return mergePostsPrepend(animated, stableApi);
  };

  const getOrCreateQueue = (slug) => {
    if (queuesBySlug.has(slug)) {
      return queuesBySlug.get(slug);
    }

    const queue = createPostFeedRevealQueue({
      gapMs,
      // Shared so reveal sequence numbers are global across all authors' queues.
      nextRevealSeq,
      // Spectator reveals merge against latest API posts — not a frozen baseline copy.
      getBaseline: () => [],
      beforeRevealPost,
      onPostRevealed,
      onPostsChange: (queuePosts) => {
        const merged = mergeAnimatedWithApiPosts(slug, queuePosts);
        recordRevealOrder(merged);
        setAllProfiles((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          if (list.length === 0) return list;
          let matched = false;
          const next = list.map((p) => {
            const ps = p?.slug ?? p?.id;
            if (String(ps) !== String(slug)) return p;
            matched = true;
            return { ...p, personaPosts: merged };
          });
          return matched ? next : list;
        });
      },
    });

    queue.establishBaseline = (posts) => {
      const list = Array.isArray(posts) ? posts : [];
      queue.markBaseline(list);
      baselineEstablished.add(slug);
    };

    queuesBySlug.set(slug, queue);
    return queue;
  };

  return {
    // Shared monotonic reveal counter. The owner's own-generation reveal queues
    // MUST allocate `_feedRevealSeq` from here too, otherwise their posts (with a
    // separate local counter starting at 1) sort below already-revealed spectator
    // posts (which hold much larger global seq values) instead of newest-on-top.
    allocRevealSeq() {
      return nextRevealSeq();
    },
    // Register reveal-seq for posts revealed outside this controller (the owner's
    // own posts) so `reconcileRevealOrder` keeps them in order across reloads.
    recordRevealOrder(posts) {
      recordRevealOrder(posts);
    },
    setSkipSlug(slug) {
      skipSlug = slug ? String(slug) : null;
    },
    setIngestAllowSlugs(slugs) {
      if (!Array.isArray(slugs)) {
        ingestAllowSlugs = null;
        return;
      }
      const keys = slugs.map((slug) => String(slug || '').trim()).filter(Boolean);
      // Empty array means "allow all" — not "block every profile".
      ingestAllowSlugs = keys.length > 0 ? new Set(keys) : null;
    },
    setExpectedRevealKey(slug, postKey) {
      const slugKey = String(slug || '').trim();
      if (!slugKey) return;
      const key = String(postKey || '').trim();
      if (!key) expectedRevealKeyBySlug.delete(slugKey);
      else expectedRevealKeyBySlug.set(slugKey, key);
    },
    ingestProfiles(profiles) {
      for (const profile of Array.isArray(profiles) ? profiles : []) {
        if (!profile) continue;
        const slug = profile.slug ?? profile.id;
        if (!slug) continue;
        const slugKey = String(slug);
        if (skipSlug && slugKey === skipSlug) continue;
        if (ingestAllowSlugs && !ingestAllowSlugs.has(slugKey)) continue;
        const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
        latestApiPostsBySlug.set(slugKey, [...posts]);

        const queue = getOrCreateQueue(slugKey);

        const expectedKey = expectedRevealKeyBySlug.get(slugKey);

        if (!baselineEstablished.has(slugKey)) {
          if (posts.length === 0) continue;
          if (expectedKey) {
            const baselinePosts = posts.filter((p) => postIdentityKey(p) !== expectedKey);
            queue.establishBaseline(baselinePosts);
          } else {
            queue.establishBaseline(posts);
            continue;
          }
        }

        if (expectedKey) {
          const waiting = posts.filter((p) => postIdentityKey(p) === expectedKey);
          if (waiting.length === 0) continue;
          const key = postIdentityKey(waiting[0]);
          if (!key || queue.hasRevealedKey(key) || queue.hasPendingKey(key)) {
            expectedRevealKeyBySlug.delete(slugKey);
            continue;
          }
          expectedRevealKeyBySlug.delete(slugKey);
          queue.enqueue(sortPostsForReveal(waiting));
          continue;
        }

        const fresh = sortPostsForReveal(
          posts.filter((p) => {
            const key = postIdentityKey(p);
            if (!key) return false;
            if (queue.hasBaselineKey(key)) return false;
            if (queue.hasRevealedKey(key)) return false;
            if (queue.hasPendingKey(key)) return false;
            return true;
          }),
        );
        if (fresh.length > 0) {
          queue.enqueue(fresh);
        }
      }
    },
    /**
     * Re-stamp the known reveal sequence onto a fresh API snapshot so the feed
     * order survives directory polls / profile reloads (which arrive without
     * `_feedRevealSeq` and would otherwise revert to stale `createdAt` order).
     */
    reconcileRevealOrder(posts) {
      const list = Array.isArray(posts) ? posts : [];
      if (revealSeqByKey.size === 0) return list;
      return list.map((p) => {
        if (!p || Number(p?._feedRevealSeq ?? 0) > 0) return p;
        const key = postIdentityKey(p);
        const seq = key ? revealSeqByKey.get(key) : 0;
        if (!seq) return p;
        return { ...p, _feedRevealSeq: seq, _feedEnterDone: true };
      });
    },
    isSlugIdle(slug) {
      const queue = queuesBySlug.get(String(slug));
      return !queue || queue.isIdle();
    },
    hasSlugRevealedKey(slug, postKey) {
      const queue = queuesBySlug.get(String(slug));
      const key = String(postKey || '').trim();
      if (!queue || !key) return false;
      return queue.hasRevealedKey(key);
    },
    async waitForSlugIdle(slug, options) {
      const queue = queuesBySlug.get(String(slug));
      if (!queue) return;
      await queue.waitUntilIdle(options);
    },
    reset() {
      skipSlug = null;
      ingestAllowSlugs = null;
      globalRevealSeq = 0;
      revealSeqByKey.clear();
      expectedRevealKeyBySlug.clear();
      baselineEstablished.clear();
      latestApiPostsBySlug.clear();
      queuesBySlug.clear();
    },
  };
}
