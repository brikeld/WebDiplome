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

  it('matches deleted sibling slugs', () => {
    expect(
      slugsReferToSameAccount('brikeld-hoxha', 'brikeld-hoxha-aaaa1111'),
    ).toBe(true);
    expect(isProfileSlugDeleted('brikeld-hoxha', ['brikeld-hoxha-bbbb2222'])).toBe(true);
  });

  it('filters ghost profiles from the feed directory', () => {
    const profiles = [
      { slug: 'brikeld-hoxha-aaaa1111', firstname: 'Brikeld', personaPosts: [{ content: 'x' }] },
      { slug: 'grace-hopper', firstname: 'Grace', personaPosts: [] },
    ];
    const out = filterProfilesNotDeleted(profiles, ['brikeld-hoxha-bbbb2222']);
    expect(out).toHaveLength(1);
    expect(out[0].firstname).toBe('Grace');
  });
});
