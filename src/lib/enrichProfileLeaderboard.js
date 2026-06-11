import { BOARDS } from '../../server/lib/leaderboards.js';
import {
  fallbackClimbTip,
  fallbackRationales,
} from '../../server/lib/leaderboardRationales.js';

const DEFAULT_CLONE_HIDDEN = [false, false, false, false];

/**
 * Profile `/api/leaderboards` rows omit post-only fields (rationales, climbTip).
 * Rebuild the same Tell-Me-More payload the feed uses when those were never stored.
 */
export function enrichProfileLeaderboardForRationale(board) {
  if (!board?.boardId || !Array.isArray(board.entries)) return board;

  const boardDef = BOARDS.find((b) => b.id === board.boardId);
  if (!boardDef) return board;

  const cloneHidden = Array.isArray(board.cloneHidden)
    ? board.cloneHidden
    : DEFAULT_CLONE_HIDDEN;

  const standing = {
    entries: board.entries,
    userRank: board.userRank ?? board.entries.find((e) => e.isUser)?.rank ?? null,
    hint: board.hint ?? 'Score derived from public profile metrics.',
  };

  return {
    ...board,
    cloneHidden,
    rationales: Array.isArray(board.rationales) && board.rationales.length
      ? board.rationales
      : fallbackRationales(boardDef, standing, cloneHidden),
    climbTip: typeof board.climbTip === 'string' && board.climbTip.trim()
      ? board.climbTip
      : fallbackClimbTip(boardDef, standing),
    hint: standing.hint,
  };
}
