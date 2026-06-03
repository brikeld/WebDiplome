import { describe, it, expect } from 'vitest';
import { resolveLeaderboardForFeed } from '../src/lib/resolveLeaderboardForFeed.js';

describe('resolveLeaderboardForFeed', () => {
  const directory = [
    { slug: 'brikeld-hoxha', firstname: 'Brikeld', lastname: 'Hoxha' },
  ];

  it('drops real rows for deleted accounts and rebuilds from directory', () => {
    const stored = {
      boardId: 'most_productive',
      title: 'Top 5 Most Productive',
      persona: 'productivite',
      userRank: 2,
      entries: [
        { rank: 1, name: 'Emanuel Masha', slug: 'emanuel-masha', source: 'real', isUser: false },
        { rank: 2, name: 'Brikeld Hoxha', slug: 'brikeld-hoxha', source: 'real', isUser: true },
        { rank: 3, name: 'Bot A', slug: 'demo-productivite-0', source: 'bot', isUser: false },
        { rank: 4, name: 'Bot B', slug: 'demo-productivite-1', source: 'bot', isUser: false },
        { rank: 5, name: 'Bot C', slug: 'demo-productivite-2', source: 'bot', isUser: false },
      ],
    };

    const remixed = resolveLeaderboardForFeed(
      stored,
      directory,
      'brikeld-hoxha',
      ['emanuel-masha'],
    );

    const names = (remixed.entries ?? []).map((e) => e.name);
    expect(names).not.toContain('Emanuel Masha');
    expect(names.some((n) => /Brikeld/i.test(String(n)))).toBe(true);
  });
});
