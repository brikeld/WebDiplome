import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePersonaPosts } from '../server/lib/personaPostGenerator.js';
import { BOARDS, computeBoardStanding } from '../server/lib/leaderboards.js';

const NOW = new Date('2026-05-25T11:00:00Z').getTime();

const fakeData = {
  MACHINE_IDENTITY: { installed_apps: ['Cursor', 'NordVPN'] },
  PAST_HISTORY: {
    app_usage_7days: [{ app: 'Cursor', last_used: '2026-05-25T10:00:00Z' }],
    recent_files_7days: [],
    browser_history: { chrome: [], safari: [] },
    wifi_history: ['Home'],
    recent_downloads: [],
  },
};
const fakeProfile = { firstname: 'Brikeld', lastname: 'Hoxha', machineName: 'brikeld-mbp' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));

  // Stub the LM Studio HTTP call so we can run without a server.
  global.fetch = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    const isLeaderboardSlot = body.messages.some((m) =>
      typeof m.content === 'string' && m.content.includes('[Leaderboard slot]'),
    );
    const content = isLeaderboardSlot
      ? '{"content":"Climbed to #1 in Most Productive — algorithm calls it a high signal.","sentiment":"positive"}'
      : '{"content":"generic post","sentiment":"positive"}';
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
    };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('generatePersonaPosts — leaderboard slot', () => {
  it('returns 4 entries (text, asset, chart, leaderboard) when nothing is excluded', async () => {
    const results = await generatePersonaPosts({
      baseUrl: 'http://stub',
      model: 'test-model',
      userPayload: JSON.stringify({ user: {}, profile: fakeProfile }),
      timeoutMs: 1000,
      retries: 0,
      assetAssignment: null,
      prompts: null,
      dataJson: fakeData,
      profile: fakeProfile,
      existingPosts: [],
    });

    expect(results).toHaveLength(4);
    const leaderboardPost = results[3];
    expect(leaderboardPost).not.toBeNull();
    expect(leaderboardPost.leaderboard).toBeTruthy();
    expect(leaderboardPost.leaderboard.boardId).toMatch(/^most_|^closest_|^ignoring_/);
    expect(Array.isArray(leaderboardPost.leaderboard.entries)).toBe(true);
    expect(leaderboardPost.leaderboard.entries).toHaveLength(5);
    expect(leaderboardPost.leaderboard.userRank).toBeGreaterThanOrEqual(1);
    expect(leaderboardPost.leaderboard.userRank).toBeLessThanOrEqual(5);
  });

  it('returns null for the leaderboard slot when no board rank has changed', async () => {
    // Lock every board at its current rank via prior posts.
    const lockingPosts = BOARDS.map((b) => {
      const s = computeBoardStanding(b, fakeData, fakeProfile, NOW);
      return {
        createdAt: '2026-05-25T10:00:00Z',
        leaderboard: { boardId: b.id, userRank: s.userRank, entries: s.entries },
      };
    });

    const results = await generatePersonaPosts({
      baseUrl: 'http://stub',
      model: 'test-model',
      userPayload: JSON.stringify({ user: {}, profile: fakeProfile }),
      timeoutMs: 1000,
      retries: 0,
      assetAssignment: null,
      prompts: null,
      dataJson: fakeData,
      profile: fakeProfile,
      existingPosts: lockingPosts,
    });

    expect(results).toHaveLength(4);
    expect(results[3]).toBeNull();
  });

  it('the leaderboard post carries previousUserRank=null on first appearance', async () => {
    const results = await generatePersonaPosts({
      baseUrl: 'http://stub',
      model: 'test-model',
      userPayload: JSON.stringify({ user: {}, profile: fakeProfile }),
      timeoutMs: 1000,
      retries: 0,
      assetAssignment: null,
      prompts: null,
      dataJson: fakeData,
      profile: fakeProfile,
      existingPosts: [],
    });
    expect(results[3].leaderboard.previousUserRank).toBeNull();
  });
});
