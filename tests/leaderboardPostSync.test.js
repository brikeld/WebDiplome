import { describe, it, expect } from 'vitest';
import {
  buildLeaderboardPostCaption,
  enrichLeaderboardPostForFeed,
} from '../src/lib/leaderboardPostSync.js';

describe('buildLeaderboardPostCaption', () => {
  it('comments on the productivity board without rank', () => {
    const caption = buildLeaderboardPostCaption({
      boardId: 'most_productive',
      title: 'Top 5 Most Productive',
    });
    expect(caption).toMatch(/productivity board/i);
    expect(caption).not.toMatch(/\d(st|nd|rd|th)/i);
    expect(caption).not.toMatch(/climbed|dropped|new to/i);
  });

  it('comments on the secure board without rank', () => {
    const caption = buildLeaderboardPostCaption({
      boardId: 'most_secure',
      title: 'Top 5 Most Secure',
    });
    expect(caption).toMatch(/secure board/i);
    expect(caption).not.toMatch(/\d(st|nd|rd|th)/i);
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

  it('replaces stale rank-focused caption when live rank drifted', () => {
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
    expect(result.content).toMatch(/productivity board/i);
    expect(result.content).not.toMatch(/\d(st|nd|rd|th)/i);
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
      storedContent: 'Productivity board has me dead to rights — tabs don’t lie.',
      directory,
      authorSlug: 'brikeld-hoxha',
    });

    expect(result.leaderboard.userRank).toBe(2);
    expect(result.content).toBe('Productivity board has me dead to rights — tabs don’t lie.');
  });
});
