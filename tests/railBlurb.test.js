import { describe, expect, it } from 'vitest';
import { clampRailBlurb, RAIL_BLURB_MAX_CHARS } from '../src/features/profile/railBlurb.js';

describe('clampRailBlurb', () => {
  it('leaves short text unchanged', () => {
    expect(clampRailBlurb('Short sentence.')).toBe('Short sentence.');
  });

  it('truncates beyond max at a word boundary', () => {
    const long = 'a'.repeat(RAIL_BLURB_MAX_CHARS + 40);
    const out = clampRailBlurb(long);
    expect(out.length).toBeLessThanOrEqual(RAIL_BLURB_MAX_CHARS);
    expect(out.endsWith('…')).toBe(true);
  });
});
