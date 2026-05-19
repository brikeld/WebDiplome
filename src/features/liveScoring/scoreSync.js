// src/features/liveScoring/scoreSync.js

const API_ORIGIN =
  (import.meta?.env?.VITE_API_ORIGIN && String(import.meta.env.VITE_API_ORIGIN)) ||
  'http://localhost:3001';

/**
 * Fire-and-forget: persists adjustedScores to the server.
 * Failures are logged but never thrown.
 */
export async function syncScoreAdjustment(profileId, adjustedScores, baseScores) {
  if (!profileId) return;

  // Net adjustments (what was applied on top of base)
  const scoreAdjustments = {
    productivity: Math.round(adjustedScores.productivity - baseScores.productivity),
    security: Math.round(adjustedScores.security - baseScores.security),
    social: Math.round(adjustedScores.social - baseScores.social),
  };

  try {
    await fetch(`${API_ORIGIN}/api/profile/${profileId}/score-adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scoreAdjustments }),
    });
  } catch (err) {
    console.warn('[liveScoring] sync failed:', err.message);
  }
}
