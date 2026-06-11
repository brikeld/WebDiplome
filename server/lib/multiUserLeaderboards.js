/**
 * Multi-user leaderboard assembly: all real profiles + deterministic bots to fill gaps.
 * Bots are dropped as real users join (minimum 5 rows when fewer than 5 humans).
 */

import {
  BOARDS,
  CLONE_IDENTITIES,
  scoreCloneFor,
} from './leaderboards.js';
import {
  avatarSrcFromProfile,
  displayNameFromProfile,
  initialsFromProfile,
  machineHandleFromProfile,
} from '../../src/lib/profileUtils.js';
import { resolveHostedPublicUrl } from './publicMediaUrls.js';
import {
  compareLeaderboardScores,
  harvestHasLeaderboardSignals,
  resolveProfileHarvestForScoring,
  scoreProfileFromPublicFields,
} from './boardProfileScoring.js';

export const MIN_LEADERBOARD_ROWS = 5;

/**
 * Did this profile's owner hide their position on this board? Mirrors the client
 * `isLeaderboardSelfHidden` (src/features/liveScoring/scoringLogic.js): a board is
 * self-hidden while its `leaderboard-self|<boardId>` record still has restorable > 0.
 * Global by construction — every viewer's build sees the same per-profile flag.
 */
function profileHidLeaderboard(profile, boardId) {
  const recs = profile?.liveScoringRecords;
  if (!recs || typeof recs !== 'object') return false;
  const rec = recs[`leaderboard-self|${boardId}`];
  return Boolean(rec) && (rec.restorable ?? 0) > 0;
}

function profileUpdatedAtMs(profile) {
  const raw =
    profile?.updatedAt ??
    profile?.updated_at ??
    profile?.collectedAt ??
    profile?.collected_at ??
    null;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * One row per person in standings: newest profile wins when user_id, slug, or
 * machine_name repeats (common after re-sync / second signup on the same Mac).
 */
export function dedupeProfilesForLeaderboards(profiles) {
  const sorted = [...(Array.isArray(profiles) ? profiles : [])]
    .filter(Boolean)
    .sort((a, b) => profileUpdatedAtMs(b) - profileUpdatedAtMs(a));

  const seenUser = new Set();
  const seenMachine = new Set();
  const seenSlug = new Set();
  const out = [];

  for (const p of sorted) {
    const uid = p?.userId ?? p?.user_id ?? null;
    const machine = String(p?.machineName ?? p?.machine_name ?? '').trim().toLowerCase();
    const slug = String(p?.slug ?? p?.id ?? '').trim();

    if (uid) {
      const key = String(uid);
      if (seenUser.has(key)) continue;
      seenUser.add(key);
    }
    if (machine) {
      if (seenMachine.has(machine)) continue;
      seenMachine.add(machine);
    }
    if (slug) {
      if (seenSlug.has(slug)) continue;
      seenSlug.add(slug);
    }
    out.push(p);
  }

  return out;
}

function scoreFromHarvest(board, harvest, profile, nowMs) {
  if (!harvestHasLeaderboardSignals(harvest)) return null;
  try {
    return board.scoreFn(harvest, profile, nowMs);
  } catch {
    return null;
  }
}

/** Persona-aligned score when full harvest JSON is unavailable (hosted multi-user). */
export function fallbackBoardScore(board, profile, nowMs = Date.now()) {
  return scoreProfileFromPublicFields(board, profile, nowMs);
}

export function scoreProfileForBoard(board, profile, nowMs = Date.now()) {
  const harvest = resolveProfileHarvestForScoring(profile);
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
    selfHidden: profileHidLeaderboard(profile, board.id),
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

  const merged = [...real, ...bots]
    .sort((a, b) => compareLeaderboardScores(board, a, b))
    .slice(0, minimumRows);
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
    selfHidden: Boolean(row.selfHidden),
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
  const uniqueProfiles = dedupeProfilesForLeaderboards(profiles);

  return BOARDS.map((board) =>
    assembleBoard(board, uniqueProfiles, { highlightSlug, minimumRows, nowMs }),
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
