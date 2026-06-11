import { describe, expect, it } from 'vitest';
import {
  filterProfileLeaderboards,
  leaderboardPresenceCount,
  profilePostCount,
  profileRankingCount,
  profileRankingCountFromPosts,
} from '../src/lib/profileUtils.js';

describe('profile header stats', () => {
  it('counts persona posts from the profile payload', () => {
    expect(profilePostCount({
      personaPosts: [
        { content: 'one' },
        { content: 'two' },
        { content: 'three' },
      ],
    })).toBe(3);

    expect(profilePostCount({
      persona_posts: [
        { content: 'one' },
        { content: 'two' },
      ],
    })).toBe(2);

    expect(profilePostCount({ personaPosts: [], postCount: 6 })).toBe(6);
  });

  it('counts unique rankings where the user appears on post snapshots', () => {
    expect(profileRankingCountFromPosts({
      personaPosts: [
        { leaderboard: { boardId: 'most_productive', userRank: 1 } },
        { leaderboard: { boardId: 'most_productive', userRank: 2 } },
        { leaderboard: { boardId: 'most_secure', userRank: 4 } },
        { leaderboard: { boardId: 'not_ranked', userRank: null } },
        { content: 'normal post' },
      ],
    })).toBe(2);
  });

  it('counts live leaderboard standings when API data is available', () => {
    const leaderboards = [
      { boardId: 'most_productive', userRank: 2 },
      { boardId: 'most_secure', userRank: 1 },
      { boardId: 'most_likely_ghost', userRank: null },
      { boardId: 'outside_top_five', userRank: 6 },
    ];

    expect(filterProfileLeaderboards(leaderboards)).toHaveLength(2);
    expect(leaderboardPresenceCount(leaderboards)).toBe(2);
    expect(profileRankingCount({ personaPosts: [] }, { leaderboards, leaderboardsReady: true })).toBe(2);
  });

  it('uses post snapshots until live standings have loaded', () => {
    expect(profileRankingCount({
      personaPosts: [{ leaderboard: { boardId: 'most_secure', userRank: 3 } }],
    }, { leaderboards: [], leaderboardsReady: false })).toBe(1);
  });

  it('trusts live standings once loaded, even when zero', () => {
    expect(profileRankingCount({
      personaPosts: [{ leaderboard: { boardId: 'most_secure', userRank: 3 } }],
    }, { leaderboards: [], leaderboardsReady: true })).toBe(0);
  });
});
