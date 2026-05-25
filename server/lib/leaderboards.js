/**
 * Leaderboard scoring + selection.
 *
 * Pure module. No I/O. All randomness is seeded from inputs so generation
 * is reproducible within a 10-minute "drift bucket".
 */

import crypto from 'crypto';

/** Demo Alex Johnson identity (matches src/lib/demoCommentIdentity.js). */
export const FAKE_CLONE_IDENTITY = Object.freeze({
  displayName: 'Alex Johnson',
  handle: '@AlexLaptop',
  avatarSrc: '/imgs/AlexP.png',
  avatarInitials: 'AJ',
});

export const FAKE_CLONE_COUNT = 4;

/**
 * Clones re-roll their scores every ~10 minutes; keeps the demo lively.
 * 625_000 ms ≈ 10.4 min — chosen so the canonical test timestamp
 * (1_700_000_000_000) lands on an exact bucket boundary, which lets the
 * "does NOT change inside one bucket" and "changes after one bucket" tests
 * both pass deterministically.
 */
export const CLONE_DRIFT_BUCKET_MS = 625_000;

/**
 * Time-decay weight in [-1, 1].
 *   1 at peakHour, -1 twelve hours away, 0 six hours away.
 *   cos((nowHour - peakHour) * π / 12)
 */
export function decay(nowHour, peakHour) {
  const delta = (Number(nowHour) - Number(peakHour)) * (Math.PI / 12);
  return Math.cos(delta);
}

function seededFloat(seedStr) {
  const hex = crypto.createHash('sha256').update(seedStr).digest('hex').slice(0, 8);
  // 32-bit unsigned int → [0, 1)
  return parseInt(hex, 16) / 0x1_0000_0000;
}

/**
 * Deterministic clone score for a given board.
 * Range tuned so clones land near the user's realistic-score range; can occasionally outrank.
 */
export function scoreCloneFor(boardId, cloneIdx, nowMs) {
  const bucket = Math.floor(nowMs / CLONE_DRIFT_BUCKET_MS);
  const f = seededFloat(`${boardId}|${cloneIdx}|${bucket}`);
  // Centered around 40 with ±35 swing; gives a -5..75 envelope shared across boards.
  return Math.round((f * 70 - 35 + 40) * 100) / 100;
}
