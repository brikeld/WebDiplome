import { describe, expect, it } from 'vitest';
import {
  filterProfilesNotDeleted,
  isProfileSlugDeleted,
  slugsReferToSameAccount,
} from '../server/lib/deletedProfileSlugs.js';

describe('server deletedProfileSlugs', () => {
  it('uses sibling matching for identity comparisons but exact matching for deletion filtering', () => {
    expect(slugsReferToSameAccount('brikeld-hoxha-a1a6ab77', 'brikeld-hoxha-324aff13')).toBe(true);
    expect(isProfileSlugDeleted('brikeld-hoxha-cccccccc', ['brikeld-hoxha-a1a6ab77'])).toBe(false);
    expect(isProfileSlugDeleted('brikeld-hoxha-a1a6ab77', ['brikeld-hoxha-a1a6ab77'])).toBe(true);
  });

  it('does not hide fresh profiles that share a deleted base slug', () => {
    const profiles = [
      { slug: 'brikeld-hoxha-cccccccc' },
      { slug: 'brikeld-hoxha-a1a6ab77' },
    ];
    expect(filterProfilesNotDeleted(profiles, ['brikeld-hoxha-a1a6ab77'])).toEqual([
      { slug: 'brikeld-hoxha-cccccccc' },
    ]);
  });
});
