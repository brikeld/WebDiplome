import { describe, expect, it } from 'vitest';
import { resolveOwnedLandingProfile } from '../src/lib/profileSlugStorage.js';

describe('resolveOwnedLandingProfile', () => {
  it('falls back to sole profile when no slug is stored', () => {
    const only = { slug: 'solo' };
    expect(resolveOwnedLandingProfile([only])).toEqual(only);
  });

  it('returns null for multi-user list without a stored slug', () => {
    const profiles = [{ slug: 'a' }, { slug: 'b' }];
    expect(resolveOwnedLandingProfile(profiles)).toBeNull();
  });
});
