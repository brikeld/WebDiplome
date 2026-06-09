import { normalizePostHideKey } from '@/lib/postHideKey.js';
import {
  isLeaderboardSelfHidden,
  isPostHidden,
  leaderboardSelfKey,
} from '@/features/liveScoring/scoringLogic.js';

function isLeaderboardRevealingFromRecords(records, boardId) {
  const key = leaderboardSelfKey(boardId);
  const rec = records?.[key];
  if (!rec) return false;
  return !isLeaderboardSelfHidden(records, boardId) && (rec.restorable ?? 0) > 0;
}

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
    const boardId = post.leaderboard.boardId;
    if (isLeaderboardSelfHidden(authorRecs, boardId)) return true;
    if (typeof viewerIsLeaderboardSelfHidden === 'function') {
      return viewerIsLeaderboardSelfHidden(boardId);
    }
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
    const boardId = post.leaderboard.boardId;
    if (isLeaderboardSelfHidden(authorRecs, boardId)) return false;
    if (isLeaderboardRevealingFromRecords(authorRecs, boardId)) return true;
    if (typeof viewerIsLeaderboardSelfRevealing === 'function') {
      return viewerIsLeaderboardSelfRevealing(boardId)
        && !(viewerIsLeaderboardSelfHidden?.(boardId));
    }
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
