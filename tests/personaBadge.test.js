import { describe, expect, it } from 'vitest';
import {
  getPersonaBadgeModel,
  resolveDominantPersonaKey,
} from '../src/lib/profileUtils.js';

describe('persona badge model', () => {
  it('uses the explicit dominant persona before post history', () => {
    const profile = {
      dominantPersona: 'securite',
      personaPosts: [
        { persona: 'popularite' },
        { persona: 'popularite' },
      ],
    };

    expect(resolveDominantPersonaKey(profile)).toBe('security');
    expect(getPersonaBadgeModel(profile)).toMatchObject({
      key: 'security',
      label: 'Security',
      glyph: 'S',
      color: '#759AEF',
    });
  });

  it('falls back to the most common post persona', () => {
    expect(
      resolveDominantPersonaKey({
        personaPosts: [
          { persona: 'productivite' },
          { persona: 'popularite' },
          { persona: 'popularite' },
        ],
      }),
    ).toBe('popularity');
  });

  it('falls back to productivity when there is no persona signal', () => {
    expect(resolveDominantPersonaKey({})).toBe('productivity');
    expect(getPersonaBadgeModel(null)).toMatchObject({
      key: 'productivity',
      glyph: 'P',
    });
  });
});
