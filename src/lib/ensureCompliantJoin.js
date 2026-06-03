import {
  createCompliantJoinPost,
  hasCompliantJoinPost,
} from '@/lib/compliantSystemPosts.js';
import { displayNameFromProfile, resolveDominantPersonaKey } from '@/lib/profileUtils.js';

function postCreatedAtMs(post) {
  const v = post?.createdAt ?? post?.created_at ?? 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

/** Join notice is a normal post; newer generated posts should bury it. */
export function joinCreatedAtBeforeExisting(posts) {
  let min = Date.now();
  for (const p of Array.isArray(posts) ? posts : []) {
    const t = postCreatedAtMs(p);
    if (Number.isFinite(t) && t <= min) min = t - 1;
  }
  return min;
}

export function buildCompliantJoinPostForProfile(profile, existingPosts = []) {
  if (!profile) return null;
  const userDisplayName = displayNameFromProfile(profile);
  const dominantPersona = resolveDominantPersonaKey(profile);
  const createdAt = joinCreatedAtBeforeExisting(existingPosts);
  return createCompliantJoinPost({
    profile,
    userDisplayName,
    dominantPersona,
    createdAt,
  });
}

export function profileNeedsCompliantJoin(profile) {
  const posts = Array.isArray(profile?.personaPosts) ? profile.personaPosts : [];
  return posts.length >= 0 && !hasCompliantJoinPost(posts);
}
