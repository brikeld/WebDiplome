import {
  isOwnAuthorPost,
  normalizePostHideKey,
  resolveViewerHideStorageKey,
} from '@/lib/postHideKey.js';
import { isPostHidden } from '@/features/liveScoring/scoringLogic.js';

/**
 * Author self-hide (author liveScoringRecords) is global; viewer curation of others' posts is local.
 */
export function resolvePostHiddenState(
  post,
  {
    authorRecords = {},
    viewerSlug = null,
    viewerIsHidden,
    viewerIsLeaderboardSelfHidden,
  },
) {
  if (post?.compliantPersonaChange || post?.compliantLowScore || post?.compliantJoin) {
    return false;
  }

  const authorRecs = authorRecords && typeof authorRecords === 'object' ? authorRecords : {};

  if (post?.leaderboard?.boardId) {
    return false;
  }

  const authorKey = normalizePostHideKey(post?.createdAt);
  if (!authorKey) return false;

  const ownPost = isOwnAuthorPost(post, viewerSlug);

  // Own posts: viewer live scoring is authoritative (profile.liveScoringRecords can lag sync).
  if (ownPost) {
    if (typeof viewerIsHidden !== 'function') return false;
    const viewerKey = resolveViewerHideStorageKey(post, viewerSlug);
    if (viewerKey && viewerIsHidden(viewerKey)) return true;
    return false;
  }

  if (isPostHidden(authorRecs, authorKey)) return true;

  if (typeof viewerIsHidden !== 'function') return false;

  const viewerKey = resolveViewerHideStorageKey(post, viewerSlug);
  if (viewerKey && viewerIsHidden(viewerKey)) return true;

  // Legacy: viewer curated another user's post using the author-global key.
  if (viewerIsHidden(authorKey)) return true;

  return false;
}

export function resolvePostRevealingState(
  post,
  {
    authorRecords = {},
    viewerSlug = null,
    viewerIsRevealing,
    viewerIsLeaderboardSelfRevealing,
    viewerIsLeaderboardSelfHidden,
  },
) {
  if (post?.compliantPersonaChange || post?.compliantLowScore || post?.compliantJoin) {
    return false;
  }

  const authorRecs = authorRecords && typeof authorRecords === 'object' ? authorRecords : {};

  if (post?.leaderboard?.boardId) {
    return false;
  }

  const authorKey = normalizePostHideKey(post?.createdAt);
  if (!authorKey) return false;

  const ownPost = isOwnAuthorPost(post, viewerSlug);

  if (ownPost) {
    if (typeof viewerIsRevealing !== 'function') return false;
    const viewerKey = resolveViewerHideStorageKey(post, viewerSlug);
    if (viewerKey && viewerIsRevealing(viewerKey)) return true;
    return false;
  }

  if (isPostHidden(authorRecs, authorKey)) return false;
  if ((authorRecs[authorKey]?.restorable ?? 0) > 0) return true;

  if (typeof viewerIsRevealing !== 'function') return false;

  const viewerKey = resolveViewerHideStorageKey(post, viewerSlug);
  if (viewerKey && viewerIsRevealing(viewerKey)) return true;

  if (viewerIsRevealing(authorKey)) return true;

  return false;
}
