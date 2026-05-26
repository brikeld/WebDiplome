/**
 * Per-entry rationale generation + parsing for leaderboard posts.
 * Pure module (no I/O) — the LM Studio call itself happens in personaPostGenerator.js
 * via the shared lmChatCompletion helper.
 */

import { RATIONALE_TEMPLATES } from './prompts.js';

const PHRASE_MAX = 90;
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
  let cloneIdx = -1;
  const rows = standing.entries.map((e) => {
    if (e.isUser) {
      return { rank: e.rank, score: Math.round(e.score), isUser: true, hidden: false };
    }
    cloneIdx += 1;
    return {
      rank: e.rank,
      score: Math.round(e.score),
      isUser: false,
      hidden: Boolean(cloneHidden[cloneIdx]),
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
export function fallbackRationales(board, standing, cloneHidden) {
  const tpl = RATIONALE_TEMPLATES[board.id] ?? {
    selfPhrase: 'classified by the algorithm',
    clonePhrases: ['', '', '', ''],
  };
  const userScore = Math.round(standing.entries.find((e) => e.isUser)?.score ?? 0);
  let cloneIdx = -1;
  return standing.entries.map((e) => {
    if (e.isUser) {
      return { rank: e.rank, phrase: tpl.selfPhrase, signal: standing.hint };
    }
    cloneIdx += 1;
    if (cloneHidden[cloneIdx]) {
      return { rank: e.rank, phrase: null, signal: null };
    }
    const phrase = tpl.clonePhrases[cloneIdx % tpl.clonePhrases.length] || 'in your zone';
    return { rank: e.rank, phrase, signal: `score ${Math.round(e.score)} \u00B7 yours ${userScore}` };
  });
}
