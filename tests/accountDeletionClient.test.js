import { describe, expect, it } from 'vitest';
import {
  filterProfilesNotDeleted,
  isProfileSlugDeleted,
  profileSlugBase,
  slugsReferToSameAccount,
} from '../src/lib/accountDeletionClient.js';

describe('accountDeletionClient', () => {
  it('normalizes hosted slug suffixes to the same base', () => {
    expect(profileSlugBase('brikeld-hoxha-bbbb2222')).toBe('brikeld-hoxha');
    expect(profileSlugBase('brikeld-hoxha')).toBe('brikeld-hoxha');
  });

  it('keeps sibling matching available for navigation helpers only', () => {
    expect(
      slugsReferToSameAccount('brikeld-hoxha', 'brikeld-hoxha-aaaa1111'),
    ).toBe(true);
  });

  it('does not mark a new sibling profile deleted from an old deleted slug', () => {
    expect(isProfileSlugDeleted('brikeld-hoxha-aaaa1111', ['brikeld-hoxha-bbbb2222'])).toBe(false);
    expect(isProfileSlugDeleted('brikeld-hoxha-bbbb2222', ['brikeld-hoxha-bbbb2222'])).toBe(true);
  });

  it('filters only exact deleted profiles from the feed directory', () => {
    const profiles = [
      { slug: 'brikeld-hoxha-aaaa1111', firstname: 'Brikeld', personaPosts: [{ content: 'x' }] },
      { slug: 'brikeld-hoxha-bbbb2222', firstname: 'Old Brikeld', personaPosts: [{ content: 'old' }] },
      { slug: 'grace-hopper', firstname: 'Grace', personaPosts: [] },
    ];
    const out = filterProfilesNotDeleted(profiles, ['brikeld-hoxha-bbbb2222']);
    expect(out.map((p) => p.firstname)).toEqual(['Brikeld', 'Grace']);
  });
});
