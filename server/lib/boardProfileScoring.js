/**
 * Multi-user leaderboard scoring when full harvest JSON is missing or thin.
 * Each board mixes persona scores, profile metadata, and deterministic per-board
 * seeds so standings differ across boards and shift when profiles update.
 */

import { decay } from './leaderboards.js';
import { CLONE_DRIFT_BUCKET_MS } from './leaderboards.js';
import { seededFloat } from '../../src/lib/seededRandom.js';

const PERSONA_UI_KEYS = {
  productivite: 'productivity',
  securite: 'security',
  popularite: 'social',
};

function hourOf(nowMs) {
  const d = new Date(nowMs);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

function profileUpdatedAtMs(profile) {
  const raw =
    profile?.updatedAt
    ?? profile?.updated_at
    ?? profile?.collectedAt
    ?? profile?.collected_at
    ?? null;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function profileCollectedAtMs(profile) {
  const raw = profile?.collectedAt ?? profile?.collected_at ?? null;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function readPersonaScores(profile) {
  const s = profile?.personaScores ?? profile?.persona_scores ?? {};
  const fallback = Number(profile?.globalScore ?? profile?.global_score ?? 50) || 50;
  return {
    productivity: Number(s.productivity ?? s.productivite ?? fallback) || fallback,
    security: Number(s.security ?? s.securite ?? fallback) || fallback,
    social: Number(s.social ?? s.popularite ?? s.popularity ?? fallback) || fallback,
  };
}

/** Per-board persona weights — derived from board id so each leaderboard ranks differently. */
function boardPersonaWeights(boardId) {
  const f1 = seededFloat(`${boardId}|persona-w|0`);
  const f2 = seededFloat(`${boardId}|persona-w|1`);
  const f3 = seededFloat(`${boardId}|persona-w|2`);
  const raw = [f1 * 1.4 + 0.2, f2 * 1.4 + 0.2, f3 * 1.4 + 0.2];
  const center = (raw[0] + raw[1] + raw[2]) / 3;
  return raw.map((v) => v - center);
}

export function harvestHasLeaderboardSignals(data) {
  if (!data || typeof data !== 'object') return false;
  const machine = data.MACHINE_IDENTITY;
  if (machine && Array.isArray(machine.installed_apps) && machine.installed_apps.length > 0) {
    return true;
  }
  const past = data.PAST_HISTORY;
  if (!past || typeof past !== 'object') return false;
  return Boolean(
    (Array.isArray(past.app_usage_7days) && past.app_usage_7days.length > 0)
    || (Array.isArray(past.recent_files_7days) && past.recent_files_7days.length > 0)
    || (Array.isArray(past.wifi_history) && past.wifi_history.length > 0)
    || (Array.isArray(past.recent_downloads) && past.recent_downloads.length > 0)
    || (past.browser_history && typeof past.browser_history === 'object'),
  );
}

/** Resolve collector-shaped data.json from a hosted profile row. */
export function resolveProfileHarvestForScoring(profile) {
  const candidates = [profile?._harvest, profile?.raw_profile, profile?.rawProfile].filter(Boolean);
  for (const raw of candidates) {
    if (typeof raw !== 'object') continue;
    const nested =
      raw.lastHarvestDataJson
      ?? raw.dataJson
      ?? raw.data_json
      ?? null;
    if (harvestHasLeaderboardSignals(nested)) return nested;
    if (harvestHasLeaderboardSignals(raw)) return raw;
  }
  return null;
}

/**
 * Board-specific score from public profile fields (no full harvest required).
 * Deterministic per slug + board + drift bucket; shifts when updated_at changes.
 */
export function scoreProfileFromPublicFields(board, profile, nowMs = Date.now()) {
  const slug = String(profile?.slug ?? profile?.id ?? 'user');
  const { productivity, security, social } = readPersonaScores(profile);
  const global = Number(profile?.globalScore ?? profile?.global_score ?? 50) || 50;
  const updatedMs = profileUpdatedAtMs(profile);
  const collectedMs = profileCollectedAtMs(profile);
  const postCount = Array.isArray(profile?.personaPosts) ? profile.personaPosts.length : 0;
  const machine = String(profile?.machineName ?? profile?.machine_name ?? '');
  const dominant = String(profile?.dominantPersona ?? profile?.dominant_persona ?? '').toLowerCase();

  const bucket = Math.floor(nowMs / CLONE_DRIFT_BUCKET_MS);
  const updateBucket = updatedMs > 0 ? Math.floor(updatedMs / (60 * 60 * 1000)) : 0;

  const [wP, wS, wSo] = boardPersonaWeights(board.id);
  const personaMix = productivity * wP + security * wS + social * wSo;

  const seedSpread =
    (seededFloat(`${slug}|${board.id}|spread|${bucket}`) - 0.5)
    * (18 + seededFloat(`${board.id}|amp`) * 42);
  const slugBoardOffset =
    (seededFloat(`${slug}|${board.id}|offset`) - 0.5) * 36;
  const updateSignal = updatedMs > 0
    ? (seededFloat(`${slug}|${board.id}|upd|${updateBucket}`) - 0.3) * 22
    : 0;

  const ageDays = collectedMs > 0 ? Math.max(0, (nowMs - collectedMs) / 86_400_000) : 7;
  const recencyPenalty = Math.min(12, ageDays * (0.4 + seededFloat(`${board.id}|age`) * 0.9));

  const globalW = 0.06 + seededFloat(`${board.id}|global-w`) * 0.28;
  const postsSignal = Math.min(10, postCount) * (0.25 + seededFloat(`${board.id}|posts-w`) * 1.1);
  const machineSignal = machine.length * (seededFloat(`${slug}|${board.id}|machine`) * 0.35);

  const uiKey = PERSONA_UI_KEYS[board.persona] ?? 'productivity';
  const primaryPersona =
    uiKey === 'productivity' ? productivity : uiKey === 'security' ? security : social;
  const personaBoost = primaryPersona * (0.12 + seededFloat(`${board.id}|primary`) * 0.55);

  const dominantMatch =
    (dominant.includes('prod') && uiKey === 'productivity')
    || (dominant.includes('sec') && uiKey === 'security')
    || ((dominant.includes('pop') || dominant.includes('social')) && uiKey === 'social');
  const dominantBonus = dominantMatch ? 4 + seededFloat(`${slug}|${board.id}|dom`) * 10 : 0;

  const bias = seededFloat(`${board.id}|bias`) * 16 - 6;
  const baseline =
    personaMix
    + global * globalW
    + seedSpread
    + slugBoardOffset
    + updateSignal
    + postsSignal
    + machineSignal
    + personaBoost
    + dominantBonus
    - recencyPenalty
    + bias;

  const decayAmp = 0.18 + seededFloat(`${board.id}|decay-amp`) * 0.38;
  const d = decay(hourOf(nowMs), board.peakHour ?? 12);
  const score = Math.max(0.01, Math.round(baseline * (1 + decayAmp * d) * 100) / 100);

  return {
    score,
    hint: 'Score derived from persona mix, profile activity, and board-specific signals.',
  };
}

/** Stable tie-break when two real users land on the same score for a board. */
export function compareLeaderboardScores(board, a, b) {
  const diff = (Number(b?.score) || 0) - (Number(a?.score) || 0);
  if (Math.abs(diff) > 1e-6) return diff;
  const ta = seededFloat(`${board.id}|tie|${a?.slug ?? a?.name ?? ''}`);
  const tb = seededFloat(`${board.id}|tie|${b?.slug ?? b?.name ?? ''}`);
  return tb - ta;
}
