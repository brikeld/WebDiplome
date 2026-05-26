import { describe, expect, it } from 'vitest';
import {
  profilePostCount,
  profileRankingCount,
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
  });

  it('counts unique rankings where the user appears', () => {
    expect(profileRankingCount({
      personaPosts: [
        { leaderboard: { boardId: 'most_productive', userRank: 1 } },
        { leaderboard: { boardId: 'most_productive', userRank: 2 } },
        { leaderboard: { boardId: 'most_secure', userRank: 4 } },
        { leaderboard: { boardId: 'not_ranked', userRank: null } },
        { content: 'normal post' },
      ],
    })).toBe(2);
  });
});
