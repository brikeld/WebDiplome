import { describe, it, expect } from 'vitest';
import {
  computeLiveAdjustments,
  computeAdjustedScores,
  applyHide,
  applyReveal,
  isPostHidden,
  dominantPersonaFromAdjustedScores,
} from '../src/features/liveScoring/scoringLogic.js';

describe('computeLiveAdjustments', () => {
  it('returns zeroes for empty records', () => {
    expect(computeLiveAdjustments({})).toEqual({ productivity: 0, security: 0, social: 0 });
  });

  it('sums deltas for the correct score key (French alias)', () => {
    const records = {
      key1: { persona: 'popularite', delta: -3, restorable: 1.5 },
      key2: { persona: 'popularite', delta: -2, restorable: 1 },
    };
    expect(computeLiveAdjustments(records)).toEqual({ productivity: 0, security: 0, social: -5 });
  });

  it('maps securite to security', () => {
    const records = { k: { persona: 'securite', delta: -4, restorable: 2 } };
    expect(computeLiveAdjustments(records).security).toBe(-4);
  });

  it('maps productivite to productivity', () => {
    const records = { k: { persona: 'productivite', delta: -1, restorable: 0.5 } };
    expect(computeLiveAdjustments(records).productivity).toBe(-1);
  });
});

describe('computeAdjustedScores', () => {
  it('clamps to 0 on large negative adjustment', () => {
    const base = { productivity: 2, security: 50, social: 50 };
    const adj = { productivity: -10, security: 0, social: 0 };
    expect(computeAdjustedScores(base, adj).productivity).toBe(0);
  });

  it('clamps to 100 on large positive adjustment', () => {
    const base = { productivity: 98, security: 50, social: 50 };
    const adj = { productivity: 10, security: 0, social: 0 };
    expect(computeAdjustedScores(base, adj).productivity).toBe(100);
  });

  it('applies adjustment correctly within bounds', () => {
    const base = { productivity: 60, security: 70, social: 80 };
    const adj = { productivity: -5, security: 3, social: -2 };
    expect(computeAdjustedScores(base, adj)).toEqual({ productivity: 55, security: 73, social: 78 });
  });
});

describe('applyHide', () => {
  it('adds a hide record with negative delta and restorable', () => {
    const result = applyHide({}, 'post-1', 'popularite', 3);
    expect(result['post-1']).toEqual({ persona: 'popularite', delta: -3, restorable: 1.5 });
  });

  it('is a no-op if post is already hidden', () => {
    const existing = { 'post-1': { persona: 'popularite', delta: -3, restorable: 1.5 } };
    expect(applyHide(existing, 'post-1', 'popularite', 3)).toBe(existing);
  });

  it('can hide again after reveal (record kept with restorable 0)', () => {
    const revealed = { 'post-1': { persona: 'popularite', delta: -1.5, restorable: 0 } };
    const result = applyHide(revealed, 'post-1', 'popularite', 3);
    expect(result['post-1']).toEqual({ persona: 'popularite', delta: -3, restorable: 1.5 });
  });

  it('does not mutate the original records object', () => {
    const original = {};
    applyHide(original, 'post-1', 'popularite', 3);
    expect(original).toEqual({});
  });
});

describe('isPostHidden', () => {
  it('is true when restorable > 0', () => {
    const records = { k: { persona: 'popularite', delta: -3, restorable: 1.5 } };
    expect(isPostHidden(records, 'k')).toBe(true);
  });

  it('is false after reveal (restorable cleared, record kept for score)', () => {
    const records = { k: { persona: 'popularite', delta: -1.5, restorable: 0 } };
    expect(isPostHidden(records, 'k')).toBe(false);
  });

  it('is false when post is not in records', () => {
    expect(isPostHidden({}, 'k')).toBe(false);
  });
});

describe('applyReveal', () => {
  it('restores 50% (restorable) to delta', () => {
    const records = { 'post-1': { persona: 'popularite', delta: -3, restorable: 1.5 } };
    const result = applyReveal(records, 'post-1');
    expect(result['post-1'].delta).toBeCloseTo(-1.5);
    expect(result['post-1'].restorable).toBe(0);
  });

  it('is a no-op if post is not in records', () => {
    const records = {};
    expect(applyReveal(records, 'post-1')).toBe(records);
  });

  it('removes record when restorable is already 0 (double reveal)', () => {
    const records = { 'post-1': { persona: 'popularite', delta: -1.5, restorable: 0 } };
    const result = applyReveal(records, 'post-1');
    expect(result['post-1']).toBeUndefined();
  });
});

describe('dominantPersonaFromAdjustedScores', () => {
  it('returns the key with the highest score', () => {
    expect(dominantPersonaFromAdjustedScores({ productivity: 40, security: 80, social: 60 })).toBe('security');
  });

  it('maps highest social score to popularity (UI key)', () => {
    expect(dominantPersonaFromAdjustedScores({ productivity: 30, security: 40, social: 90 })).toBe('popularity');
  });

  it('returns productivity on tie (first in order)', () => {
    expect(dominantPersonaFromAdjustedScores({ productivity: 50, security: 50, social: 50 })).toBe('productivity');
  });
});
