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
    if (queuesBySlug.has(slug)) return queuesBySlug.get(slug);
    const fixedBaseline = [...(Array.isArray(baselinePosts) ? baselinePosts : [])];
    const queue = createPostFeedRevealQueue({
      gapMs,
      getBaseline: () => fixedBaseline,
      onPostsChange: (personaPosts) => {
        setAllProfiles((prev) =>
          (Array.isArray(prev) ? prev : []).map((p) => {
            const ps = p?.slug ?? p?.id;
            if (String(ps) !== String(slug)) return p;
            return { ...p, personaPosts };
          }),
        );
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
      queuesBySlug.clear();
    },
  };
}
