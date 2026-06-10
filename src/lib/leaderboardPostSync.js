import { BOARDS } from '../../server/lib/leaderboards.js';
import {
  fallbackClimbTip,
  fallbackRationales,
} from '../../server/lib/leaderboardRationales.js';
import { resolveLeaderboardForFeed } from '@/lib/resolveLeaderboardForFeed.js';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];

function ordinalRank(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1 || n > 5) return `#${rank ?? '—'}`;
  return ORDINALS[n - 1];
}

/** Short board label for captions — mirrors LeaderboardBlock title formatting. */
export function shortLeaderboardTitle(title) {
  const text = String(title ?? '').trim();
  const match = text.match(/^top\s+5\s+(.+)$/i);
  return match ? match[1] : text;
}

/**
 * Deterministic first-person caption aligned with the live leaderboard block.
 * Uses the same rank + previousUserRank contract as DeltaChip.
 */
export function buildLeaderboardPostCaption({ userRank, previousUserRank, title }) {
  const board = shortLeaderboardTitle(title);
  const rank = ordinalRank(userRank);
  if (previousUserRank == null) {
    return `${rank} on ${board}. New to this board.`;
  }
  if (previousUserRank === userRank) {
    return `${rank} on ${board} — same spot as last time.`;
  }
  if (userRank < previousUserRank) {
    return `${rank} on ${board} — climbed from ${ordinalRank(previousUserRank)}.`;
  }
  return `${rank} on ${board} — down from ${ordinalRank(previousUserRank)}.`;
}

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
      userRank: liveUserRank,
      previousUserRank: base.previousUserRank,
      title: base.title,
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
