import { normalizePostHideKey } from '@/lib/postHideKey.js';
import { isPostHidden } from '@/features/liveScoring/scoringLogic.js';

/**
 * Author-synced hide (profile owner, visible to everyone) plus viewer-only hide in the home feed.
 */
export function resolvePostHiddenState(
  post,
  {
    authorRecords = {},
    viewerIsHidden,
    viewerIsLeaderboardSelfHidden,
  },
) {
  if (post?.compliantPersonaChange || post?.compliantLowScore || post?.compliantJoin) {
    return false;
  }

  const authorRecs = authorRecords && typeof authorRecords === 'object' ? authorRecords : {};

  if (post?.leaderboard?.boardId) {
    // Leaderboard hide is viewer-local and row-only (LeaderboardBlock / profile tab).
    return false;
  }

  const hideKey = normalizePostHideKey(post?.createdAt);
  if (!hideKey) return false;
  if (isPostHidden(authorRecs, hideKey)) return true;
  if (typeof viewerIsHidden === 'function') {
    return viewerIsHidden(hideKey);
  }
  return false;
}

export function resolvePostRevealingState(
  post,
  {
    authorRecords = {},
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

  const hideKey = normalizePostHideKey(post?.createdAt);
  if (!hideKey) return false;
  if (isPostHidden(authorRecs, hideKey)) return false;
  if ((authorRecs[hideKey]?.restorable ?? 0) > 0) return true;
  if (typeof viewerIsRevealing === 'function') {
    return viewerIsRevealing(hideKey);
  }
  return false;
}
