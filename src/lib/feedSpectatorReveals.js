import { mergePostsPrepend, postIdentityKey } from '@/lib/mergePersonaPosts.js';
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
      // Spectator reveals merge against latest API posts — not a frozen baseline copy.
      getBaseline: () => [],
      onPostRevealed,
      onPostsChange: (queuePosts) => {
        const merged = mergeAnimatedWithApiPosts(slug, queuePosts);
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
    setSkipSlug(slug) {
      skipSlug = slug ? String(slug) : null;
    },
    setIngestAllowSlugs(slugs) {
      if (!Array.isArray(slugs)) {
        ingestAllowSlugs = null;
        return;
      }
      ingestAllowSlugs = new Set(
        slugs.map((slug) => String(slug || '').trim()).filter(Boolean),
      );
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

        if (!baselineEstablished.has(slugKey)) {
          if (posts.length === 0) continue;
          queue.establishBaseline(posts);
          continue;
        }

        const expectedKey = expectedRevealKeyBySlug.get(slugKey);
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
    isSlugIdle(slug) {
      const queue = queuesBySlug.get(String(slug));
      return !queue || queue.isIdle();
    },
    async waitForSlugIdle(slug, options) {
      const queue = queuesBySlug.get(String(slug));
      if (!queue) return;
      await queue.waitUntilIdle(options);
    },
    reset() {
      skipSlug = null;
      ingestAllowSlugs = null;
      expectedRevealKeyBySlug.clear();
      baselineEstablished.clear();
      latestApiPostsBySlug.clear();
      queuesBySlug.clear();
    },
  };
}
