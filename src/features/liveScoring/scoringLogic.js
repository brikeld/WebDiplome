export const PERSONA_TO_SCORE_KEY = {
  popularite: 'social',
  popularity: 'social',
  social: 'social',
  securite: 'security',
  security: 'security',
  productivite: 'productivity',
  productivity: 'productivity',
};

// UI axis key used on ring cards: maps score key back to UI key
export const SCORE_KEY_TO_RING_ATTR = {
  social: 'popularity',
  security: 'security',
  productivity: 'productivity',
};

/**
 * records: { [postKey]: { persona: string, delta: number, restorable: number } }
 * Returns { productivity, security, social } net adjustments.
 */
export function computeLiveAdjustments(records) {
  const adj = { productivity: 0, security: 0, social: 0 };
  for (const rec of Object.values(records)) {
    const key = PERSONA_TO_SCORE_KEY[String(rec.persona).toLowerCase()] ?? 'productivity';
    adj[key] += rec.delta;
  }
  return adj;
}

/** Clamp base + adjustments to [0, 100]. */
export function computeAdjustedScores(baseScores, liveAdjustments) {
  const clamp = (v) => Math.max(0, Math.min(100, v));
  return {
    productivity: clamp(baseScores.productivity + liveAdjustments.productivity),
    security: clamp(baseScores.security + liveAdjustments.security),
    social: clamp(baseScores.social + liveAdjustments.social),
  };
}

/**
 * Returns new records after hiding a post.
 * No-op if already hidden.
 */
export function applyHide(records, postKey, persona, systemDeltaPct) {
  if (records[postKey]) return records;
  const delta = -Math.abs(systemDeltaPct);
  return {
    ...records,
    [postKey]: {
      persona: String(persona).toLowerCase(),
      delta,
      restorable: Math.abs(systemDeltaPct) * 0.5,
    },
  };
}

/**
 * Returns new records after revealing a post (decay: restores 50%).
 * No-op if not hidden.
 */
export function applyReveal(records, postKey) {
  const rec = records[postKey];
  if (!rec) return records;
  const restored = rec.restorable ?? 0;
  if (restored === 0) {
    // Nothing to restore — remove record (hidden state cleared)
    const next = { ...records };
    delete next[postKey];
    return next;
  }
  return {
    ...records,
    [postKey]: { ...rec, delta: rec.delta + restored, restorable: 0 },
  };
}

/**
 * Returns UI persona key ('productivity' | 'security' | 'popularity')
 * for the highest-scoring axis.
 */
export function dominantPersonaFromAdjustedScores(adjustedScores) {
  const entries = [
    ['productivity', adjustedScores.productivity],
    ['security', adjustedScores.security],
    ['popularity', adjustedScores.social],
  ];
  return entries.reduce((best, curr) => (curr[1] > best[1] ? curr : best))[0];
}
