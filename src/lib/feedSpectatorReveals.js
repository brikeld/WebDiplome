import { postIdentityKey } from '@/lib/mergePersonaPosts.js';
import {
  createPostFeedRevealQueue,
  POST_REVEAL_GAP_MS,
  sortPostsForReveal,
} from '@/lib/postFeedRevealQueue.js';

/**
 * When the global profile directory poll picks up new posts from other users,
 * reveal them on the home feed with the same staggered enter animation.
 */
export function createFeedSpectatorRevealController({ setAllProfiles, gapMs = POST_REVEAL_GAP_MS }) {
  const queuesBySlug = new Map();
  let skipSlug = null;

  const getOrCreateQueue = (slug, baselinePosts) => {
    const incoming = [...(Array.isArray(baselinePosts) ? baselinePosts : [])];
    if (queuesBySlug.has(slug)) {
      const queue = queuesBySlug.get(slug);
      // First poll may have had zero posts; expand baseline when the API catches up.
      if (incoming.length > 0) {
        queue.markBaseline(incoming);
      }
      return queue;
    }
    const fixedBaseline = incoming;
    const queue = createPostFeedRevealQueue({
      gapMs,
      getBaseline: () => fixedBaseline,
      onPostsChange: (personaPosts) => {
        setAllProfiles((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          if (list.length === 0) return list;
          let matched = false;
          const next = list.map((p) => {
            const ps = p?.slug ?? p?.id;
            if (String(ps) !== String(slug)) return p;
            matched = true;
            return { ...p, personaPosts };
          });
          return matched ? next : list;
        });
      },
    });
    queue.markBaseline(fixedBaseline);
    queuesBySlug.set(slug, queue);
    return queue;
  };

  return {
    setSkipSlug(slug) {
      skipSlug = slug ? String(slug) : null;
    },
    ingestProfiles(profiles) {
      for (const profile of Array.isArray(profiles) ? profiles : []) {
        if (!profile) continue;
        const slug = profile.slug ?? profile.id;
        if (!slug) continue;
        if (skipSlug && String(slug) === skipSlug) continue;

        const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
        const queue = getOrCreateQueue(String(slug), posts);

        const fresh = sortPostsForReveal(
          posts.filter((p) => {
            const key = postIdentityKey(p);
            return key && !queue.hasRevealedKey(key);
          }),
        );
        if (fresh.length > 0) {
          queue.enqueue(fresh);
        }
      }
    },
    reset() {
      skipSlug = null;
      queuesBySlug.clear();
    },
  };
}
