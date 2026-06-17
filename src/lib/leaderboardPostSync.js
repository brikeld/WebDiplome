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

/**
 * Does the caption name a specific leaderboard position (which goes stale when
 * the live rank drifts)? Board-themed captions — the default the generator now
 * produces — talk about the board itself, never the position, so they stay
 * accurate forever and should be kept rather than swapped for the repetitive
 * deterministic fallback.
 */
function captionMentionsRank(content) {
  const text = String(content ?? '');
  return (
    /\b\d+\s*(st|nd|rd|th)\b/i.test(text) // 1st, 2nd, 3rd…
    || /#\s*\d/.test(text) // #1, # 2
    || /\b(rank(ed|ing)?|climb(ed|ing)?|dropp(ed|ing)?|moved\s+(up|down)|new\s+to\s+(the\s+)?board)\b/i.test(text)
  );
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

  // The remixed entries are the live top rows; the author keeps an `isUser` row
  // only while they are actually in the top 5 of the current directory.
  const authorInTopRows = Array.isArray(remixed.entries)
    && remixed.entries.some((e) => e?.isUser);

  const liveUserRank = remixed.userRank ?? postedUserRank;
  const rankDrifted =
    liveUserRank != null
    && postedUserRank != null
    && liveUserRank !== postedUserRank;

  let content = String(storedContent ?? '').trim();
  let rationales = base.rationales;
  let climbTip = base.climbTip;

  if (rankDrifted) {
    // Rationales + climb tip are rank-dependent — always refresh them on drift.
    const board = boardForId(base.boardId);
    if (board) {
      const standing = standingFromRemixed(remixed, authorSlug);
      rationales = fallbackRationales(board, standing, base.cloneHidden);
      climbTip = fallbackClimbTip(board, standing);
    }
    // The caption only needs replacing if it actually names a now-stale rank.
    // Keep board-themed captions so the feed shows the varied AI text instead of
    // the static deterministic fallback.
    if (captionMentionsRank(content)) {
      content = buildLeaderboardPostCaption({
        boardId: base.boardId,
        title: base.title,
        hint: remixed.hint ?? base.hint,
      });
    }
  }

  return {
    content,
    // A leaderboard post is only valid while its author is still in the top 5.
    authorInTopRows,
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
