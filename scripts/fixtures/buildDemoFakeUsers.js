/**
 * Transforms the fake-user roster + authored content into seedable
 * profile/posts objects. Pure functions — the seed script does the file I/O.
 *
 * Seeded slugs are plain `{first}-{last}` (NOT `demo-video-*`): App.jsx drops
 * `demo-video-*` profiles from state when the ▶ button stops, and these users
 * must survive as regular server-backed profiles.
 */
import { getFakeUsers } from '../../src/lib/demoVideoFakeUsers.js';
import {
  SEEDED_SLUGS,
  DEMO_FAKE_POSTS,
  BRIKELD_POST_COMMENTS,
} from './demoFakeContent.js';

const MINUTE_MS = 60_000;

/** Roster entry for a seeded slug (matches by de-prefixed roster slug). */
function rosterUserForSlug(slug) {
  const user = getFakeUsers().find(
    (u) => String(u.slug).replace(/^demo-video-/, '') === slug,
  );
  if (!user) throw new Error(`No roster user for seeded slug "${slug}"`);
  return user;
}

/** Expand { bySlug } comment refs into full commenter identities. */
export function expandComments(comments) {
  return (Array.isArray(comments) ? comments : []).map((c) => {
    const { bySlug, ...rest } = c;
    const user = rosterUserForSlug(bySlug);
    return {
      ...rest,
      displayName: user.displayName,
      handle: user.handle,
      avatarSrc: user.avatarUrl,
      avatarInitials: user.avatarInitials,
      personaBadgePersona: user.dominantPersona,
    };
  });
}

/** Profile JSON for a seeded fake user (posts live in a sibling posts file). */
function seededProfileFor(slug) {
  const { __demoVideoFake, personaPosts, ...profile } = rosterUserForSlug(slug);
  return {
    ...profile,
    slug,
    id: slug,
    demoFake: true,
  };
}

/**
 * @returns {[{ slug, profile, posts }]} one entry per seeded user, posts
 * newest-first with absolute ISO createdAt derived from ageMinutes.
 */
export function buildSeededFakeUsers(nowMs = Date.now()) {
  return SEEDED_SLUGS.map((slug) => {
    const posts = DEMO_FAKE_POSTS
      .filter((entry) => entry.authorSlug === slug)
      .sort((a, b) => a.ageMinutes - b.ageMinutes)
      .map((entry, i) => ({
        id: `seed-${slug}-${i}`,
        ...entry.post,
        createdAt: new Date(nowMs - entry.ageMinutes * MINUTE_MS).toISOString(),
        comments: expandComments(entry.post.comments),
      }));
    return { slug, profile: seededProfileFor(slug), posts };
  });
}

/**
 * Rebase Brikeld's fixture posts so the feed looks current (newest = now − 45
 * min, then 35-minute steps, preserving order) and attach comment sets to the
 * newest posts.
 */
export function injectBrikeldComments(posts, nowMs = Date.now()) {
  return (Array.isArray(posts) ? posts : []).map((post, i) => {
    const rebased = {
      ...post,
      createdAt: new Date(nowMs - (45 + i * 35) * MINUTE_MS).toISOString(),
    };
    const commentSet = BRIKELD_POST_COMMENTS[i];
    if (commentSet) rebased.comments = expandComments(commentSet);
    return rebased;
  });
}
