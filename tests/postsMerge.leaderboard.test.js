import { describe, expect, it } from 'vitest';
import {
  appendPostsForceGrow,
  collectLeaderboardBoardIds,
  stripLeaderboardPostsByBoardIds,
} from '../server/lib/postsMerge.js';
import { dedupeLeaderboardPostsNewestOnly } from '../src/lib/leaderboardFeedDedupe.js';

describe('leaderboard post merge', () => {
  const boardPost = (boardId, rank, content = 'lb post') => ({
    persona: 'productivite',
    content,
    createdAt: '2026-06-09T10:00:00Z',
    leaderboard: { boardId, userRank: rank, title: 'Board', entries: [] },
  });

  it('collectLeaderboardBoardIds gathers board ids from incoming posts', () => {
    const ids = collectLeaderboardBoardIds([
      boardPost('most_productive', 1),
      { persona: 'securite', content: 'plain' },
      boardPost('most_secure', 3),
    ]);
    expect([...ids].sort()).toEqual(['most_productive', 'most_secure']);
  });

  it('appendPostsForceGrow replaces prior post for the same board on one profile', () => {
    const baseline = [
      boardPost('most_productive', 2, 'old rank 2'),
      { persona: 'popularite', content: 'photo post', createdAt: '2026-06-08T10:00:00Z' },
    ];
    const incoming = [boardPost('most_productive', 1, 'climbed to 1')];
    const merged = appendPostsForceGrow(incoming, baseline);
    const lbPosts = merged.filter((p) => p.leaderboard?.boardId === 'most_productive');
    expect(lbPosts).toHaveLength(1);
    expect(lbPosts[0].content).toBe('climbed to 1');
    expect(merged).toHaveLength(2);
  });

  it('stripLeaderboardPostsByBoardIds removes matching boards only', () => {
    const posts = [
      boardPost('most_productive', 1),
      boardPost('most_secure', 2),
      { persona: 'popularite', content: 'plain' },
    ];
    const cleaned = stripLeaderboardPostsByBoardIds(posts, new Set(['most_productive']));
    expect(cleaned).toHaveLength(2);
    expect(cleaned.some((p) => p.leaderboard?.boardId === 'most_productive')).toBe(false);
  });

  it('dedupeLeaderboardPostsNewestOnly keeps newest post per board in feed order', () => {
    const posts = [
      boardPost('most_productive', 1, 'user B newest'),
      boardPost('most_productive', 3, 'user A older'),
      boardPost('most_secure', 2, 'security board'),
    ];
    const deduped = dedupeLeaderboardPostsNewestOnly(posts);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].content).toBe('user B newest');
    expect(deduped[1].content).toBe('security board');
  });
});
