/**
 * Per-entry rationale generation + parsing for leaderboard posts.
 * Pure module (no I/O) — the LM Studio call itself happens in personaPostGenerator.js
 * via the shared lmChatCompletion helper.
 */

import { RATIONALE_TEMPLATES } from './prompts.js';
import { isLeaderboardBotEntry } from '../../src/lib/leaderboardEntryVisibility.js';

const PHRASE_MAX = 90;
const CLIMB_TIP_MAX = 110;
const RATIONALE_COUNT = 5;

function truncate(s) {
  if (typeof s !== 'string') return null;
  return s.length > PHRASE_MAX ? s.slice(0, PHRASE_MAX) : s;
}

function normalizeOne(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rank = Number(raw.rank);
  if (!Number.isInteger(rank) || rank < 1 || rank > RATIONALE_COUNT) return null;
  const phrase = raw.phrase == null ? null : truncate(String(raw.phrase));
  const signal = raw.signal == null ? null : String(raw.signal);
  return { rank, phrase, signal };
}

/**
 * Returns 5 normalized rationale rows in ascending rank order, or null if the
 * response is unusable (caller falls back to templates).
 */
export function parseRationalesResponse(rawText) {
  if (typeof rawText !== 'string') return null;
  let obj;
  try {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (!m) return null;
    obj = JSON.parse(m[0]);
  } catch {
    return null;
  }
  if (!obj || !Array.isArray(obj.rationales) || obj.rationales.length !== RATIONALE_COUNT) {
    return null;
  }
  const normalized = obj.rationales.map(normalizeOne).filter(Boolean);
  if (normalized.length !== RATIONALE_COUNT) return null;
  normalized.sort((a, b) => a.rank - b.rank);
  const ranks = normalized.map((r) => r.rank);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return null;
  return normalized;
}

/**
 * Build the LM Studio user-message payload for a rationales call.
 */
export function buildRationalesPayload(board, standing, cloneHidden) {
  const userScore = standing.entries.find((e) => e.isUser)?.score ?? 0;
  let botIdx = -1;
  const rows = standing.entries.map((e) => {
    if (e.isUser) {
      return { rank: e.rank, score: Math.round(e.score), isUser: true, hidden: false };
    }
    if (!isLeaderboardBotEntry(e)) {
      return { rank: e.rank, score: Math.round(e.score), isUser: false, hidden: false };
    }
    botIdx += 1;
    return {
      rank: e.rank,
      score: Math.round(e.score),
      isUser: false,
      hidden: Boolean(cloneHidden[botIdx]),
    };
  });
  return [
    `Board: ${board.title}`,
    `Scoring rule (plain English): ${standing.hint}`,
    `User score: ${Math.round(userScore)}`,
    `Entries:`,
    JSON.stringify(rows),
  ].join('\n');
}

/**
 * Deterministic template-based fallback. Always returns 5 entries.
 */
/**
 * Parse LLM climb-tip response. Returns trimmed string or null.
 */
export function parseClimbTipResponse(rawText) {
  if (typeof rawText !== 'string') return null;
  let obj;
  try {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (!m) return null;
    obj = JSON.parse(m[0]);
  } catch {
    return null;
  }
  const tip = obj?.climbTip ?? obj?.text ?? obj?.tip;
  if (typeof tip !== 'string' || !tip.trim()) return null;
  const trimmed = tip.trim();
  return trimmed.length > CLIMB_TIP_MAX ? trimmed.slice(0, CLIMB_TIP_MAX) : trimmed;
}

export function buildClimbTipPayload(board, standing) {
  const user = standing.entries.find((e) => e.isUser);
  const userRank = user?.rank ?? standing.userRank ?? '?';
  const targetRank = Number(userRank) > 1 ? Number(userRank) - 1 : null;
  return [
    `Board: ${board.title}`,
    `Scoring rule: ${standing.hint}`,
    `Your rank: ${userRank} of 5`,
    targetRank != null ? `Next rank to reach: #${targetRank}` : 'You are already #1.',
    `Your signals: ${standing.hint}`,
  ].join('\n');
}

const CLIMB_TIP_FALLBACK = {
  most_productive: 'To climb this board, spend more time in work apps and less in entertainment.',
  closest_to_burnout: 'To climb this board, add more late-night file edits and fewer social-app breaks.',
  most_likely_change_jobs: 'To climb this board, visit job boards more and keep file output lower.',
  ignoring_health: 'To climb this board, work later, skip the health app, and roam more café wifi.',
  most_secure: 'To climb this board, use VPN tools and stick to a small set of known networks.',
  most_socially_isolated: 'To climb this board, use fewer social apps and keep your wifi footprint small.',
  most_likely_ghost: 'To climb this board, cut comms apps while keeping everything else busy.',
  most_likely_miss_deadline: 'To climb this board, open more entertainment tabs and keep file output low.',
  replaced_by_ai_90_days: 'To climb this board, lean harder on AI tools and ship fewer files yourself.',
  least_with_expensive_setup: 'To climb this board, upgrade hardware and keep entertainment time high.',
  procrastinate_right_now: 'To climb this board, favor social and entertainment apps over work right now.',
  quit_to_countryside: 'To climb this board, browse rural listings and job boards while cutting comms.',
  get_hacked_this_month: 'To climb this board, drop VPN use, add torrents, and ignore system warnings.',
  tracked_by_third_parties: 'To climb this board, browse more ad-heavy sites without a VPN.',
  ignoring_system_warnings: 'To climb this board, let storage fill up and leave security toggles off.',
  leak_confidential_accident: 'To climb this board, sync more files through comms and cloud apps.',
  messiest_digital_life: 'To climb this board, install more apps, download more, and save every wifi network.',
  havent_left_house: 'To climb this board, stay on home wifi and skip out-of-home networks.',
  talking_to_ais_not_people: 'To climb this board, spend more time in AI apps and less in comms.',
  least_sleep: 'To climb this board, edit files late at night and skip the sleep app.',
};

export function fallbackClimbTip(board, standing) {
  const userRank = standing.entries.find((e) => e.isUser)?.rank ?? standing.userRank;
  if (userRank === 1) {
    return 'You are #1 on this board — keep doing what the algorithm already likes.';
  }
  return CLIMB_TIP_FALLBACK[board.id] ?? 'To climb this board, lean into what this ranking rewards.';
}

export function fallbackRationales(board, standing, cloneHidden) {
  const tpl = RATIONALE_TEMPLATES[board.id] ?? {
    selfPhrase: 'classified by the algorithm',
    clonePhrases: ['', '', '', ''],
  };
  let botIdx = -1;
  return standing.entries.map((e) => {
    if (e.isUser) {
      return { rank: e.rank, phrase: tpl.selfPhrase, signal: standing.hint };
    }
    if (!isLeaderboardBotEntry(e)) {
      return { rank: e.rank, phrase: 'in your zone', signal: `score ${Math.round(e.score)}` };
    }
    botIdx += 1;
    if (cloneHidden[botIdx]) {
      return { rank: e.rank, phrase: null, signal: null };
    }
    const phrase = tpl.clonePhrases[botIdx % tpl.clonePhrases.length] || 'in your zone';
    return { rank: e.rank, phrase, signal: `score ${Math.round(e.score)}` };
  });
}
