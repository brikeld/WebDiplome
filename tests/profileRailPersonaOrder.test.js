import { describe, expect, it } from 'vitest';
import { orderRailPersonasByDominant } from '../src/features/profile/railPersonas.js';

describe('orderRailPersonasByDominant', () => {
  it('puts dominant persona first', () => {
    expect(orderRailPersonasByDominant('security').map((p) => p.key)).toEqual([
      'security',
      'productivity',
      'social',
    ]);
  });

  it('maps french persona keys', () => {
    expect(orderRailPersonasByDominant('productivite').map((p) => p.key)[0]).toBe('productivity');
  });
});
