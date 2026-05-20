import { describe, expect, it } from 'vitest';
import { personaPercentToRingFill } from '../src/lib/profileUtils.js';

describe('personaPercentToRingFill', () => {
  it('returns 0 for empty scores', () => {
    expect(personaPercentToRingFill(0)).toBe(0);
    expect(personaPercentToRingFill(null)).toBe(0);
  });

  it('maps an even third to a mid fill (~52)', () => {
    expect(personaPercentToRingFill(33)).toBe(52);
    expect(personaPercentToRingFill(40)).toBeGreaterThan(52);
  });

  it('boosts low shares above raw percent', () => {
    expect(personaPercentToRingFill(22)).toBeGreaterThan(22);
    expect(personaPercentToRingFill(22)).toBeLessThan(52);
  });

  it('reaches 100 at full share', () => {
    expect(personaPercentToRingFill(100)).toBe(100);
  });

  it('keeps ordering between persona shares', () => {
    const a = personaPercentToRingFill(22);
    const b = personaPercentToRingFill(39);
    expect(b).toBeGreaterThan(a);
  });
});
