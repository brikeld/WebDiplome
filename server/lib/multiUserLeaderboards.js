/**
 * Multi-user leaderboard assembly: all real profiles + deterministic bots to fill gaps.
 * Bots are dropped as real users join (minimum 5 rows when fewer than 5 humans).
 */

import {
  BOARDS,
  CLONE_IDENTITIES,
  CLONE_DRIFT_BUCKET_MS,
  scoreCloneFor,
} from './leaderboards.js';
import {
  avatarSrcFromProfile,
  displayNameFromProfile,
  initialsFromProfile,
  machineHandleFromProfile,
} from '../../src/lib/profileUtils.js';
import { resolveHostedPublicUrl } from './publicMediaUrls.js';
import { seededFloat } from '../../src/lib/seededRandom.js';

export const MIN_LEADERBOARD_ROWS = 5;

const PERSONA_UI_KEYS = {
  productivite: 'productivity',
  securite: 'security',
  popularite: 'popularity',
};

function scoreFromHarvest(board, harvest, profile, nowMs) {
  if (harvest && typeof harvest === 'object' && Object.keys(harvest).length > 0) {
    try {
      return board.scoreFn(harvest, profile, nowMs);
    } catch {
      /* fall through */
    }
  }
  return null;
}

/** Persona-aligned score when full harvest JSON is unavailable (hosted multi-user). */
export function fallbackBoardScore(board, profile, nowMs = Date.now()) {
  const scores = profile?.personaScores ?? profile?.persona_scores ?? {};
  const uiKey = PERSONA_UI_KEYS[board.persona] ?? 'productivity';
  const base = Number(
    scores[uiKey]
    ?? scores[board.persona]
    ?? profile?.globalScore
    ?? profile?.global_score
    ?? 50,
  );
  const bucket = Math.floor(nowMs / CLONE_DRIFT_BUCKET_MS);
  const jitter = (seededFloat(`${profile?.slug ?? profile?.id}|${board.id}|${bucket}`) - 0.5) * 10;
  const score = Math.max(1, Math.round((base + jitter) * 100) / 100);
  return {
    score,
    hint: 'Score derived from public profile metrics.',
  };
}

export function scoreProfileForBoard(board, profile, nowMs = Date.now()) {
  const harvest = profile?._harvest ?? profile?.raw_profile ?? profile?.rawProfile ?? null;
  return scoreFromHarvest(board, harvest, profile, nowMs) ?? fallbackBoardScore(board, profile, nowMs);
}

function profileAvatarSrc(profile) {
  const base64 = profile?.wallpaperBase64 ?? profile?.wallpaper_base64 ?? null;
  if (base64 && String(base64).startsWith('data:')) return String(base64);

  const candidate =
    profile?.avatarUrl ??
    profile?.avatar_url ??
    profile?.wallpaperUrl ??
    profile?.wallpaper_url ??
    null;
  if (candidate) {
    const resolved = resolveHostedPublicUrl(candidate);
    if (resolved) return resolved;
  }

  return avatarSrcFromProfile(profile) || null;
}

function realUserEntry(profile, board, nowMs, highlightSlug) {
  const slug = profile?.slug ?? profile?.id ?? null;
  const { score, hint } = scoreProfileForBoard(board, profile, nowMs);
  return {
    slug,
    name: displayNameFromProfile(profile),
    handle: machineHandleFromProfile(profile),
    avatarSrc: profileAvatarSrc(profile),
    avatarInitials: initialsFromProfile(profile),
    score: Number(score) || 0,
    isUser: Boolean(highlightSlug && slug && String(slug) === String(highlightSlug)),
    source: 'real',
    hint,
  };
}

function botEntry(board, botIndex, nowMs) {
  const ident = CLONE_IDENTITIES[botIndex % CLONE_IDENTITIES.length];
  return {
    slug: `demo-${board.id}-${botIndex}`,
    name: ident.displayName,
    handle: ident.handle,
    avatarInitials: ident.avatarInitials,
    score: scoreCloneFor(board.id, botIndex, nowMs),
    isUser: false,
    source: 'bot',
  };
}

function assembleBoard(board, profiles, { highlightSlug, minimumRows, nowMs }) {
  const real = (Array.isArray(profiles) ? profiles : [])
    .filter(Boolean)
    .map((p) => realUserEntry(p, board, nowMs, highlightSlug));

  const botsNeeded = Math.max(0, minimumRows - real.length);
  const bots = Array.from({ length: botsNeeded }, (_, i) => botEntry(board, i, nowMs));

  const merged = [...real, ...bots].sort((a, b) => b.score - a.score);
  const entries = merged.map((row, i) => ({
    rank: i + 1,
    name: row.name,
    handle: row.handle,
    avatarSrc: row.avatarSrc ?? null,
    avatarInitials: row.avatarInitials,
    score: row.score,
    isUser: row.isUser,
    source: row.source,
    slug: row.slug,
  }));

  const userRank = entries.find((e) => e.isUser)?.rank ?? null;
  const userHint = real.find((r) => r.isUser)?.hint
    ?? real.find((r) => String(r.slug) === String(highlightSlug))?.hint
    ?? entries.find((e) => e.isUser)?.hint
    ?? 'Score derived from public profile metrics.';

  return {
    boardId: board.id,
    title: board.title,
    persona: board.persona,
    peakHour: board.peakHour,
    entries,
    userRank,
    hint: userHint,
  };
}

/**
 * @param {object[]} profiles — public profile rows (optionally with `_harvest` / raw_profile)
 * @param {{ viewerSlug?: string|null, authorSlug?: string|null, minimumRows?: number, nowMs?: number }} opts
 */
export function buildMultiUserLeaderboards(profiles, opts = {}) {
  const {
    viewerSlug = null,
    authorSlug = null,
    minimumRows = MIN_LEADERBOARD_ROWS,
    nowMs = Date.now(),
  } = opts;
  const highlightSlug = authorSlug ?? viewerSlug ?? null;

  return BOARDS.map((board) =>
    assembleBoard(board, profiles, { highlightSlug, minimumRows, nowMs }),
  );
}

/** Refresh a stored post leaderboard snapshot using the current user directory. */
export function remixStoredLeaderboard(leaderboard, profiles, authorSlug, nowMs = Date.now()) {
  if (!leaderboard?.boardId) return leaderboard;
  const board = BOARDS.find((b) => b.id === leaderboard.boardId);
  if (!board) return leaderboard;

  const fresh = assembleBoard(board, profiles, {
    highlightSlug: authorSlug,
    minimumRows: MIN_LEADERBOARD_ROWS,
    nowMs,
  });

  return {
    ...leaderboard,
    entries: fresh.entries,
    userRank: fresh.userRank,
    hint: fresh.hint ?? leaderboard.hint,
  };
}
