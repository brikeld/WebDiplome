import { BOARDS } from '../../server/lib/leaderboards.js';
import {
  buildLeaderboardPostCaption,
  shortLeaderboardTitle,
} from '../../server/lib/leaderboardCaption.js';
import {
  fallbackClimbTip,
  fallbackRationales,
} from '../../server/lib/leaderboardRationales.js';
import { resolveLeaderboardForFeed } from '@/lib/resolveLeaderboardForFeed.js';

export { shortLeaderboardTitle, buildLeaderboardPostCaption } from '../../server/lib/leaderboardCaption.js';

function boardForId(boardId) {
  return BOARDS.find((b) => b.id === boardId) ?? null;
}

function standingFromRemixed(remixed, authorSlug) {
  const entries = Array.isArray(remixed.entries) ? remixed.entries : [];
  const userRank = remixed.userRank ?? entries.find((e) => e.isUser)?.rank ?? null;
  const hint = remixed.hint ?? 'Score derived from public profile metrics.';
  return { entries, userRank, hint };
}

/**
 * Remix stored leaderboard rows to the current directory, then sync caption /
 * rationales / climb tip when live rank drifted since the post was written.
 */
export function enrichLeaderboardPostForFeed({
  storedLeaderboard,
  storedContent,
  directory,
  authorSlug,
  deletedProfileIds = [],
}) {
  if (!storedLeaderboard?.boardId || !Array.isArray(storedLeaderboard.entries)) {
    return { content: storedContent, leaderboard: storedLeaderboard };
  }

  const postedUserRank =
    storedLeaderboard.postedUserRank ?? storedLeaderboard.userRank ?? null;
  const base = {
    boardId: storedLeaderboard.boardId,
    title: storedLeaderboard.title,
    persona: storedLeaderboard.persona,
    userRank: postedUserRank,
    postedUserRank,
    previousUserRank: storedLeaderboard.previousUserRank ?? null,
    cloneHidden: Array.isArray(storedLeaderboard.cloneHidden)
      ? storedLeaderboard.cloneHidden
      : [false, false, false, false],
    rationales: Array.isArray(storedLeaderboard.rationales)
      ? storedLeaderboard.rationales
      : null,
    climbTip: typeof storedLeaderboard.climbTip === 'string'
      ? storedLeaderboard.climbTip
      : null,
    hint: storedLeaderboard.hint ?? null,
  };

  const remixed = resolveLeaderboardForFeed(
    { ...base, entries: storedLeaderboard.entries },
    directory,
    authorSlug,
    deletedProfileIds,
  );

  const liveUserRank = remixed.userRank ?? postedUserRank;
  const rankDrifted =
    liveUserRank != null
    && postedUserRank != null
    && liveUserRank !== postedUserRank;

  let content = String(storedContent ?? '').trim();
  let rationales = base.rationales;
  let climbTip = base.climbTip;

  if (rankDrifted) {
    content = buildLeaderboardPostCaption({
      boardId: base.boardId,
      title: base.title,
      hint: remixed.hint ?? base.hint,
    });
    const board = boardForId(base.boardId);
    if (board) {
      const standing = standingFromRemixed(remixed, authorSlug);
      rationales = fallbackRationales(board, standing, base.cloneHidden);
      climbTip = fallbackClimbTip(board, standing);
    }
  }

  return {
    content,
    leaderboard: {
      ...base,
      postedUserRank,
      userRank: liveUserRank,
      hint: remixed.hint ?? base.hint,
      entries: remixed.entries ?? [],
      rationales,
      climbTip,
    },
  };
}
