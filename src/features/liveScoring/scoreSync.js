// src/features/liveScoring/scoreSync.js

import { API_ORIGIN } from '@/lib/apiClient.js';
import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { hostedAuthHeaders } from '@/lib/hostedAccount.js';

/**
 * Fire-and-forget: persists live scoring records on hosted deployments.
 */
export async function syncLiveScoringRecords(profileSlug, records) {
  const slug = String(profileSlug || '').trim();
  if (!slug || !isHostedApiOrigin()) return;

  const headers = {
    'Content-Type': 'application/json',
    ...hostedAuthHeaders(),
  };
  if (!headers.Authorization) return;

  try {
    await fetch(`${API_ORIGIN}/api/profile/${encodeURIComponent(slug)}/live-scoring`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ records: records ?? {} }),
    });
  } catch (err) {
    console.warn('[liveScoring] hosted records sync failed:', err.message);
  }
}

/**
 * Fire-and-forget: persists adjustedScores to the server.
 * Failures are logged but never thrown.
 */
export async function syncScoreAdjustment(profileId, adjustedScores, baseScores) {
  if (!profileId || isHostedApiOrigin()) return;

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
