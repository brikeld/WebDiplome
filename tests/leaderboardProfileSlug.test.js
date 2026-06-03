import { describe, it, expect } from 'vitest';
import { leaderboardEntryProfileSlug } from '../src/lib/leaderboardProfileSlug.js';

describe('leaderboardEntryProfileSlug', () => {
  it('returns slug for real multi-user rows', () => {
    expect(
      leaderboardEntryProfileSlug({ source: 'real', slug: 'ada-lovelace', isUser: false }),
    ).toBe('ada-lovelace');
  });

  it('falls back to author slug for the highlighted user row when in directory', () => {
    expect(
      leaderboardEntryProfileSlug(
        { source: 'real', isUser: true },
        'brikeld-hoxha',
        ['brikeld-hoxha'],
      ),
    ).toBe('brikeld-hoxha');
  });

  it('returns null for deleted real rows not in directory', () => {
    expect(
      leaderboardEntryProfileSlug(
        { source: 'real', slug: 'emanuel-masha', isUser: false },
        'brikeld-hoxha',
        ['brikeld-hoxha'],
      ),
    ).toBeNull();
  });

  it('returns null for bot rows', () => {
    expect(
      leaderboardEntryProfileSlug({ source: 'bot', slug: 'demo-most_secure-0', isUser: false }),
    ).toBeNull();
  });
});
