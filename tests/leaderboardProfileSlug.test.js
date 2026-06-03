import { describe, it, expect } from 'vitest';
import { leaderboardEntryProfileSlug } from '../src/lib/leaderboardProfileSlug.js';

describe('leaderboardEntryProfileSlug', () => {
  it('returns slug for real multi-user rows', () => {
    expect(
      leaderboardEntryProfileSlug({ source: 'real', slug: 'ada-lovelace', isUser: false }),
    ).toBe('ada-lovelace');
  });

  it('falls back to author slug for the highlighted user row without slug', () => {
    expect(
      leaderboardEntryProfileSlug({ source: 'real', isUser: true }, 'brikeld-hoxha'),
    ).toBe('brikeld-hoxha');
  });

  it('returns null for bot rows', () => {
    expect(
      leaderboardEntryProfileSlug({ source: 'bot', slug: 'demo-most_secure-0', isUser: false }),
    ).toBeNull();
  });
});
