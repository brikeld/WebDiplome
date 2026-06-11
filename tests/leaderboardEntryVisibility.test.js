import { describe, expect, it } from 'vitest';
import {
  isLeaderboardBotEntry,
  mapLeaderboardEntryHiddenFlags,
} from '../src/lib/leaderboardEntryVisibility.js';

describe('leaderboardEntryVisibility', () => {
  const entries = [
    { rank: 1, isUser: true, source: 'real', name: 'You' },
    { rank: 2, isUser: false, source: 'real', name: 'Grace' },
    { rank: 3, isUser: false, source: 'bot', name: 'M. Laurent' },
    { rank: 4, isUser: false, source: 'bot', name: 'S. Park' },
    { rank: 5, isUser: false, source: 'bot', name: 'R. Chen' },
  ];

  it('never hides other real users via cloneHidden', () => {
    const hidden = mapLeaderboardEntryHiddenFlags(entries, {
      viewerRowHidden: false,
      cloneHidden: [true, false, false],
    });
    expect(hidden).toEqual([false, false, true, false, false]);
  });

  it('hides the viewer row by slug, not the post author isUser flag', () => {
    const mixed = [
      { rank: 1, isUser: true, source: 'real', slug: 'alice', name: 'Alice' },
      { rank: 2, isUser: false, source: 'real', slug: 'bob', name: 'Bob' },
    ];
    const hidden = mapLeaderboardEntryHiddenFlags(mixed, {
      viewerSlug: 'bob',
      viewerRowHidden: true,
      cloneHidden: [],
    });
    expect(hidden).toEqual([false, true]);
  });

  it('redacts a real user globally when their entry is selfHidden', () => {
    const mixed = [
      { rank: 1, isUser: true, source: 'real', slug: 'alice', name: 'Alice' },
      { rank: 2, isUser: false, source: 'real', slug: 'bob', name: 'Bob', selfHidden: true },
      { rank: 3, isUser: false, source: 'real', slug: 'carol', name: 'Carol' },
    ];
    // No viewer-local hide, no bots — only Bob's own global self-hide applies.
    const hidden = mapLeaderboardEntryHiddenFlags(mixed, {
      viewerSlug: 'zoe',
      viewerRowHidden: false,
      cloneHidden: [],
    });
    expect(hidden).toEqual([false, true, false]);
  });

  it('classifies bots and legacy demo slugs', () => {
    expect(isLeaderboardBotEntry({ source: 'bot' })).toBe(true);
    expect(isLeaderboardBotEntry({ source: 'real' })).toBe(false);
    expect(isLeaderboardBotEntry({ slug: 'demo-most_secure-0' })).toBe(true);
    expect(isLeaderboardBotEntry({ name: 'Legacy' })).toBe(true);
  });
});
