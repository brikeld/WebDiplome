// src/features/liveScoring/scoreSync.js

import { API_ORIGIN } from '@/lib/apiClient.js';

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
