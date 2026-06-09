import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generatePersonaPosts,
  pickThirdSlotKind,
} from '../server/lib/personaPostGenerator.js';
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

function aiTextPosts(count) {
  return Array.from({ length: count }, (_, i) => ({
    content: `post ${i}`,
    persona: 'productivite',
    createdAt: `2026-05-20T${String(i).padStart(2, '0')}:00:00Z`,
  }));
}

describe('pickThirdSlotKind', () => {
  it('defaults to chart when no prior chart or leaderboard posts exist', () => {
    expect(pickThirdSlotKind([])).toBe('chart');
  });

  it('holds chart until enough AI posts have landed since the last leaderboard', () => {
    const chartOnly = [
      { chartType: 'browser_domains', createdAt: '2026-05-25T10:00:00Z' },
      ...aiTextPosts(3),
    ];
    expect(pickThirdSlotKind(chartOnly)).toBe('chart');

    const ready = [
      { chartType: 'browser_domains', createdAt: '2026-05-25T10:00:00Z' },
      ...aiTextPosts(5),
    ];
    expect(pickThirdSlotKind(ready)).toBe('leaderboard');
  });

  it('alternates back to chart after a leaderboard post', () => {
    expect(pickThirdSlotKind([
      { leaderboard: { boardId: 'most_productive' }, createdAt: '2026-05-25T10:00:00Z' },
      ...aiTextPosts(6),
    ])).toBe('chart');
  });
});

describe('generatePersonaPosts — third slot alternation', () => {
  it('returns 3 entries with chart at slot 2 on first generation', async () => {
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

    expect(results).toHaveLength(3);
    expect(results[2]?.chartType || results[2]?.attachedAsset?.url).toBeTruthy();
    expect(results[2]?.leaderboard).toBeFalsy();
  });

  it('uses leaderboard at slot 2 after a prior chart post', async () => {
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
      existingPosts: [
        { chartType: 'browser_domains', createdAt: '2026-05-25T09:00:00Z' },
        ...aiTextPosts(5),
      ],
    });

    expect(results).toHaveLength(3);
    const third = results[2];
    expect(third).not.toBeNull();
    expect(third.leaderboard).toBeTruthy();
    expect(third.leaderboard.boardId).toBeTruthy();
    expect(Array.isArray(third.leaderboard.entries)).toBe(true);
    expect(third.leaderboard.entries).toHaveLength(5);
  });

  it('falls back to chart at slot 2 when leaderboard turn has no rank change', async () => {
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
      existingPosts: [
        { chartType: 'browser_domains', createdAt: '2026-05-25T09:30:00Z' },
        ...lockingPosts,
      ],
    });

    expect(results).toHaveLength(3);
    expect(results[2]).not.toBeNull();
    expect(results[2].leaderboard).toBeFalsy();
    expect(results[2].chartType || results[2].attachedAsset?.url).toBeTruthy();
  });

  it('leaderboard post carries previousUserRank=null on first appearance', async () => {
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
      existingPosts: [
        { chartType: 'browser_domains', createdAt: '2026-05-25T09:00:00Z' },
        ...aiTextPosts(5),
      ],
    });
    expect(results[2].leaderboard.previousUserRank).toBeNull();
  });
});
