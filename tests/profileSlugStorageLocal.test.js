import { describe, it, expect } from 'vitest';
import { resolveLocalFallbackOwnedProfile } from '../src/lib/profileSlugStorage.js';

describe('resolveLocalFallbackOwnedProfile', () => {
  it('picks the first non-demoFake profile (list is newest-first)', () => {
    const profiles = [
      { slug: 'camille-laurent', demoFake: true },
      { slug: 'brikeld-hoxha' },
      { slug: 'theo-moreau', demoFake: true },
    ];
    expect(resolveLocalFallbackOwnedProfile(profiles)?.slug).toBe('brikeld-hoxha');
  });

  it('returns null when all profiles are demo fakes', () => {
    expect(resolveLocalFallbackOwnedProfile([{ slug: 'x', demoFake: true }])).toBeNull();
  });

  it('returns null for empty/invalid input', () => {
    expect(resolveLocalFallbackOwnedProfile([])).toBeNull();
    expect(resolveLocalFallbackOwnedProfile(null)).toBeNull();
  });
});
