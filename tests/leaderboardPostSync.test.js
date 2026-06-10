import { describe, it, expect } from 'vitest';
import {
  buildLeaderboardPostCaption,
  enrichLeaderboardPostForFeed,
} from '../src/lib/leaderboardPostSync.js';

describe('buildLeaderboardPostCaption', () => {
  it('describes a climb from a previous post rank', () => {
    expect(buildLeaderboardPostCaption({
      userRank: 2,
      previousUserRank: 4,
      title: 'Top 5 Most Productive',
    })).toBe('2nd on Most Productive — climbed from 4th.');
  });

  it('describes a first appearance on a board', () => {
    expect(buildLeaderboardPostCaption({
      userRank: 3,
      previousUserRank: null,
      title: 'Top 5 Most Secure',
    })).toBe('3rd on Most Secure. New to this board.');
  });
});

describe('enrichLeaderboardPostForFeed', () => {
  const directory = [
    {
      slug: 'brikeld-hoxha',
      firstname: 'Brikeld',
      lastname: 'Hoxha',
      machineName: 'Mac',
      personaScores: { productivity: 80, security: 50, social: 40 },
    },
    {
      slug: 'lea-demo',
      firstname: 'Lea',
      lastname: 'Demo',
      machineName: 'Mac',
      personaScores: { productivity: 95, security: 50, social: 40 },
    },
  ];

  it('replaces stale caption when live rank drifted since the post was written', () => {
    const stored = {
      boardId: 'most_productive',
      title: 'Top 5 Most Productive',
      persona: 'productivite',
      postedUserRank: 3,
      userRank: 3,
      previousUserRank: 4,
      cloneHidden: [false, false, false, false],
      entries: [
        { rank: 1, name: 'Lea Demo', slug: 'lea-demo', source: 'real', isUser: false, score: 99 },
        { rank: 2, name: 'Brikeld Hoxha', slug: 'brikeld-hoxha', source: 'real', isUser: true, score: 90 },
        { rank: 3, name: 'Bot A', slug: 'demo-productivite-0', source: 'bot', isUser: false, score: 80 },
        { rank: 4, name: 'Bot B', slug: 'demo-productivite-1', source: 'bot', isUser: false, score: 70 },
        { rank: 5, name: 'Bot C', slug: 'demo-productivite-2', source: 'bot', isUser: false, score: 60 },
      ],
    };

    const result = enrichLeaderboardPostForFeed({
      storedLeaderboard: stored,
      storedContent: 'Still 3rd on productivity — holding steady.',
      directory,
      authorSlug: 'brikeld-hoxha',
    });

    expect(result.leaderboard.userRank).toBe(2);
    expect(result.content).toBe('2nd on Most Productive — climbed from 4th.');
    expect(result.content).not.toContain('3rd');
  });

  it('keeps original LLM caption when live rank still matches posted rank', () => {
    const stored = {
      boardId: 'most_productive',
      title: 'Top 5 Most Productive',
      persona: 'productivite',
      userRank: 2,
      previousUserRank: 4,
      cloneHidden: [false, false, false, false],
      entries: [
        { rank: 1, name: 'Lea Demo', slug: 'lea-demo', source: 'real', isUser: false, score: 99 },
        { rank: 2, name: 'Brikeld Hoxha', slug: 'brikeld-hoxha', source: 'real', isUser: true, score: 90 },
        { rank: 3, name: 'Bot A', slug: 'demo-productivite-0', source: 'bot', isUser: false, score: 80 },
        { rank: 4, name: 'Bot B', slug: 'demo-productivite-1', source: 'bot', isUser: false, score: 70 },
        { rank: 5, name: 'Bot C', slug: 'demo-productivite-2', source: 'bot', isUser: false, score: 60 },
      ],
    };

    const result = enrichLeaderboardPostForFeed({
      storedLeaderboard: stored,
      storedContent: 'Algorithm says I am crushing it at #2.',
      directory,
      authorSlug: 'brikeld-hoxha',
    });

    expect(result.leaderboard.userRank).toBe(2);
    expect(result.content).toBe('Algorithm says I am crushing it at #2.');
  });
});
