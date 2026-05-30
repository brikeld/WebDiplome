import { describe, expect, it } from 'vitest';
import { resolveOwnedLandingProfile } from '../src/lib/profileSlugStorage.js';

describe('resolveOwnedLandingProfile', () => {
  it('returns null when no slug is stored', () => {
    const only = { slug: 'solo' };
    expect(resolveOwnedLandingProfile([only])).toBeNull();
  });

  it('returns null for multi-user list without a stored slug', () => {
    const profiles = [{ slug: 'a' }, { slug: 'b' }];
    expect(resolveOwnedLandingProfile(profiles)).toBeNull();
  });
});
