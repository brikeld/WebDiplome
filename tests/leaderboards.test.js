import { describe, it, expect } from 'vitest';
import {
  BOARDS,
  CLONE_DRIFT_BUCKET_MS,
  computeAllBoardStandings,
  computeBoardStanding,
  decay,
  FAKE_CLONE_COUNT,
  FAKE_CLONE_IDENTITY,
  pickBoardToPost,
  scoreCloneFor,
} from '../server/lib/leaderboards.js';

describe('decay(nowHour, peakHour)', () => {
  it('returns 1 at the peak hour', () => {
    expect(decay(11, 11)).toBeCloseTo(1, 5);
  });

  it('returns -1 twelve hours from peak (antipeak)', () => {
    expect(decay(23, 11)).toBeCloseTo(-1, 5);
  });

  it('returns 0 six hours from peak', () => {
    expect(decay(17, 11)).toBeCloseTo(0, 5);
    expect(decay(5, 11)).toBeCloseTo(0, 5);
  });

  it('wraps across midnight', () => {
    expect(decay(1, 23)).toBeCloseTo(decay(23, 1), 5);
  });
});

describe('FAKE_CLONE_IDENTITY + FAKE_CLONE_COUNT', () => {
  it('matches the demo commenter identity used elsewhere', () => {
    expect(FAKE_CLONE_IDENTITY.displayName).toBe('Alex Johnson');
    expect(FAKE_CLONE_IDENTITY.handle).toBe('@AlexLaptop');
    expect(FAKE_CLONE_IDENTITY.avatarSrc).toBe('/imgs/AlexP.png');
    expect(FAKE_CLONE_IDENTITY.avatarInitials).toBe('AJ');
  });

  it('exposes 4 clones', () => {
    expect(FAKE_CLONE_COUNT).toBe(4);
  });
});

describe('scoreCloneFor', () => {
  it('is deterministic for the same boardId / cloneIdx / nowMs', () => {
    const t = 1_699_999_800_000;
    expect(scoreCloneFor('most_productive', 0, t)).toBe(
      scoreCloneFor('most_productive', 0, t),
    );
  });

  it('differs across cloneIdx for the same board / nowMs', () => {
    const t = 1_699_999_800_000;
    const a = scoreCloneFor('most_productive', 0, t);
    const b = scoreCloneFor('most_productive', 1, t);
    const c = scoreCloneFor('most_productive', 2, t);
    const d = scoreCloneFor('most_productive', 3, t);
    expect(new Set([a, b, c, d]).size).toBeGreaterThan(1);
  });

  it('changes when the 10-minute drift bucket advances', () => {
    const t1 = 1_699_999_800_000;
    const t2 = t1 + CLONE_DRIFT_BUCKET_MS;
    expect(scoreCloneFor('most_productive', 0, t1)).not.toBe(
      scoreCloneFor('most_productive', 0, t2),
    );
  });

  it('does NOT change inside a single 10-minute bucket', () => {
    const t1 = 1_699_999_800_000;
    const t2 = t1 + CLONE_DRIFT_BUCKET_MS - 1;
    expect(scoreCloneFor('most_productive', 0, t1)).toBe(
      scoreCloneFor('most_productive', 0, t2),
    );
  });

  it('returns a finite number', () => {
    const t = Date.now();
    for (let i = 0; i < 4; i++) {
      const s = scoreCloneFor('most_productive', i, t);
      expect(Number.isFinite(s)).toBe(true);
    }
  });
});

describe('BOARDS', () => {
  it('declares all 7 boards in priority order', () => {
    expect(BOARDS.map(b => b.id)).toEqual([
      'most_productive',
      'closest_to_burnout',
      'most_likely_change_jobs',
      'ignoring_health',
      'most_secure',
      'most_socially_isolated',
      'most_likely_ghost',
    ]);
  });

  it('every board declares id, title, persona, peakHour, scoreFn', () => {
    for (const b of BOARDS) {
      expect(typeof b.id).toBe('string');
      expect(typeof b.title).toBe('string');
      expect(['productivite', 'securite', 'popularite']).toContain(b.persona);
      expect(typeof b.peakHour).toBe('number');
      expect(b.peakHour).toBeGreaterThanOrEqual(0);
      expect(b.peakHour).toBeLessThanOrEqual(23);
      expect(typeof b.scoreFn).toBe('function');
    }
  });
});

describe('scoreFn(dataJson, profile, nowMs) for every board', () => {
  // Static nowMs at hour 11 UTC so decay results are predictable across boards.
  const NOW_MS_11 = new Date('2026-05-25T11:00:00Z').getTime();

  const richData = {
    MACHINE_IDENTITY: {
      installed_apps: [
        'Cursor', 'Visual Studio Code', 'Figma', 'Notion',
        'Adobe Photoshop 2025', 'NordVPN', 'GlobalProtect',
        'Discord', 'Slack',
      ],
    },
    PAST_HISTORY: {
      app_usage_7days: [
        { app: 'Cursor',   last_used: '2026-05-25T10:00:00Z' },
        { app: 'Figma',    last_used: '2026-05-25T10:30:00Z' },
        { app: 'Notion',   last_used: '2026-05-24T22:00:00Z' },
        { app: 'Adobe Photoshop 2025', last_used: '2026-05-24T23:30:00Z' },
        { app: 'Slack',    last_used: '2026-05-25T09:00:00Z' },
        { app: 'Discord',  last_used: '2026-05-25T08:00:00Z' },
      ],
      recent_files_7days: [
        { date: '2026-05-25T23:30:00Z' },
        { date: '2026-05-25T00:30:00Z' },
        { date: '2026-05-25T10:00:00Z' },
      ],
      browser_history: {
        chrome: [
          { url: 'https://www.linkedin.com/jobs', title: 'Jobs' },
          { url: 'https://github.com/foo', title: 'GitHub' },
        ],
        safari: [],
      },
      wifi_history: ['Home-5G', 'Office', 'Ginevra Cafe', 'COFFEE PAGE'],
      recent_downloads: [],
    },
  };

  const leanData = {
    MACHINE_IDENTITY: { installed_apps: ['Spotify', 'Netflix'] },
    PAST_HISTORY: {
      app_usage_7days: [
        { app: 'Spotify', last_used: '2026-05-25T10:00:00Z' },
        { app: 'Netflix', last_used: '2026-05-25T11:00:00Z' },
      ],
      recent_files_7days: [],
      browser_history: { chrome: [], safari: [] },
      wifi_history: ['Home'],
      recent_downloads: [],
    },
  };

  const profile = { personaScores: { productivity: 60, security: 40, social: 50 } };

  for (const board of BOARDS) {
    it(`${board.id} returns { score: number, hint: string }`, () => {
      const r = board.scoreFn(richData, profile, NOW_MS_11);
      expect(typeof r).toBe('object');
      expect(typeof r.score).toBe('number');
      expect(Number.isFinite(r.score)).toBe(true);
      expect(typeof r.hint).toBe('string');
      expect(r.hint.length).toBeGreaterThan(0);
    });
  }

  it('most_productive scores higher with work/creative apps than with entertainment-only', () => {
    const board = BOARDS.find(b => b.id === 'most_productive');
    const rich = board.scoreFn(richData, profile, NOW_MS_11);
    const lean = board.scoreFn(leanData, profile, NOW_MS_11);
    expect(rich.score).toBeGreaterThan(lean.score);
  });

  it('most_secure scores higher with VPN apps installed', () => {
    const board = BOARDS.find(b => b.id === 'most_secure');
    const rich = board.scoreFn(richData, profile, NOW_MS_11);
    const lean = board.scoreFn(leanData, profile, NOW_MS_11);
    expect(rich.score).toBeGreaterThan(lean.score);
  });

  it('most_socially_isolated scores higher with fewer social apps used', () => {
    const board = BOARDS.find(b => b.id === 'most_socially_isolated');
    const rich = board.scoreFn(richData, profile, NOW_MS_11);
    const lean = board.scoreFn(leanData, profile, NOW_MS_11);
    // lean data has zero social-app usage → more isolated
    expect(lean.score).toBeGreaterThan(rich.score);
  });

  it('scores shift with nowMs (time-decay drives change)', () => {
    const board = BOARDS.find(b => b.id === 'most_productive');
    const t11 = new Date('2026-05-25T11:00:00Z').getTime();  // peak
    const t23 = new Date('2026-05-25T23:00:00Z').getTime();  // antipeak
    const a = board.scoreFn(richData, profile, t11).score;
    const b = board.scoreFn(richData, profile, t23).score;
    expect(a).not.toBe(b);
  });
});

describe('computeBoardStanding', () => {
  const data = {
    MACHINE_IDENTITY: { installed_apps: ['Cursor', 'Figma', 'NordVPN'] },
    PAST_HISTORY: {
      app_usage_7days: [
        { app: 'Cursor', last_used: '2026-05-25T10:00:00Z' },
        { app: 'Figma',  last_used: '2026-05-25T10:30:00Z' },
      ],
      recent_files_7days: [],
      browser_history: { chrome: [], safari: [] },
      wifi_history: ['Home'],
      recent_downloads: [],
    },
  };
  const profile = {
    firstname: 'Brikeld',
    lastname: 'Hoxha',
    machineName: 'brikeld-mbp',
  };
  const board = BOARDS.find((b) => b.id === 'most_productive');
  const nowMs = new Date('2026-05-25T11:00:00Z').getTime();

  it('returns 5 entries with ranks 1..5', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    expect(standing.entries).toHaveLength(5);
    expect(standing.entries.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('userRank points to the real user (matched by handle/displayName)', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    const userEntry = standing.entries.find((e) => e.rank === standing.userRank);
    expect(userEntry.name).toBe('Brikeld Hoxha');
    expect(userEntry.handle).toBe('@brikeld-mbp');
  });

  it('returns the hint string emitted by the board scoreFn', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    expect(typeof standing.hint).toBe('string');
    expect(standing.hint.length).toBeGreaterThan(0);
  });

  it('the 4 non-user entries all render as Alex Johnson', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    const clones = standing.entries.filter((e) => e.name === 'Alex Johnson');
    expect(clones).toHaveLength(4);
    for (const c of clones) {
      expect(c.handle).toBe('@AlexLaptop');
      expect(c.avatarSrc).toBe('/imgs/AlexP.png');
    }
  });

  it('sorts strictly by score desc (ties broken by stable order)', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    for (let i = 1; i < standing.entries.length; i++) {
      expect(standing.entries[i - 1].score).toBeGreaterThanOrEqual(standing.entries[i].score);
    }
  });

  it('falls back to a default display name when profile lacks names', () => {
    const standing = computeBoardStanding(board, data, {}, nowMs);
    const user = standing.entries.find((e) => e.handle === '@—');
    expect(user).toBeTruthy();
  });
});

describe('computeAllBoardStandings', () => {
  const data = {
    MACHINE_IDENTITY: { installed_apps: ['Cursor', 'Figma', 'NordVPN'] },
    PAST_HISTORY: {
      app_usage_7days: [
        { app: 'Cursor', last_used: '2026-05-25T10:00:00Z' },
        { app: 'Figma', last_used: '2026-05-25T10:30:00Z' },
      ],
      recent_files_7days: [],
      browser_history: { chrome: [], safari: [] },
      wifi_history: ['Home'],
      recent_downloads: [],
    },
  };
  const profile = { firstname: 'Brikeld', lastname: 'Hoxha', machineName: 'brikeld-mbp' };
  const nowMs = new Date('2026-05-25T11:00:00Z').getTime();

  it('returns one standing for every board, even when no leaderboard post exists', () => {
    const standings = computeAllBoardStandings(data, profile, nowMs);

    expect(standings).toHaveLength(BOARDS.length);
    expect(standings.map((s) => s.boardId)).toEqual(BOARDS.map((b) => b.id));
    for (const standing of standings) {
      expect(standing.title).toBeTruthy();
      expect(standing.persona).toMatch(/productivite|securite|popularite/);
      expect(standing.entries).toHaveLength(5);
      expect(standing.userRank).toBeGreaterThanOrEqual(1);
      expect(standing.userRank).toBeLessThanOrEqual(5);
    }
  });
});

describe('pickBoardToPost', () => {
  const NOW = new Date('2026-05-25T11:00:00Z').getTime();
  const data = {
    MACHINE_IDENTITY: { installed_apps: ['Cursor', 'NordVPN'] },
    PAST_HISTORY: {
      app_usage_7days: [{ app: 'Cursor', last_used: '2026-05-25T10:00:00Z' }],
      recent_files_7days: [],
      browser_history: { chrome: [], safari: [] },
      wifi_history: ['Home'],
      recent_downloads: [],
    },
  };
  const profile = { firstname: 'Brikeld', lastname: 'Hoxha', machineName: 'brikeld-mbp' };

  it('returns a board choice when no prior leaderboard posts exist (first-ever appearance)', () => {
    const result = pickBoardToPost(data, profile, [], NOW);
    expect(result).not.toBeNull();
    expect(result.board).toBeTruthy();
    expect(result.standing.userRank).toBeGreaterThanOrEqual(1);
    expect(result.prevRank).toBeNull();
  });

  it('skips boards whose userRank matches the most recent post for that board', () => {
    // Build a "prior post" capturing the current rank for EVERY board, so no delta.
    const priorPosts = BOARDS.map((b) => {
      const s = computeBoardStanding(b, data, profile, NOW);
      return {
        createdAt: '2026-05-25T10:00:00Z',
        leaderboard: { boardId: b.id, userRank: s.userRank, entries: s.entries },
      };
    });

    const result = pickBoardToPost(data, profile, priorPosts, NOW);
    expect(result).toBeNull();
  });

  it('first-appearance counts as max delta (priority order breaks ties)', () => {
    // Prior posts cover the LAST 6 boards (locking them at their current rank); only
    // the first board (most_productive) is "new" → it should be chosen.
    const priorPosts = BOARDS.slice(1).map((b) => {
      const s = computeBoardStanding(b, data, profile, NOW);
      return {
        createdAt: '2026-05-25T10:00:00Z',
        leaderboard: { boardId: b.id, userRank: s.userRank, entries: s.entries },
      };
    });
    const result = pickBoardToPost(data, profile, priorPosts, NOW);
    expect(result).not.toBeNull();
    expect(result.board.id).toBe('most_productive');
    expect(result.prevRank).toBeNull();
  });

  it('ignores non-leaderboard posts when scanning prior state', () => {
    const priorPosts = [
      { createdAt: '2026-05-25T10:00:00Z', persona: 'productivite', content: 'normal post' },
      { createdAt: '2026-05-25T09:00:00Z', persona: 'securite', content: 'another' },
    ];
    const result = pickBoardToPost(data, profile, priorPosts, NOW);
    expect(result).not.toBeNull();
    expect(result.prevRank).toBeNull();
  });

  it('uses the MOST RECENT leaderboard post per board (first match in array)', () => {
    // posts/{id}.json is stored newest-first; the lookup must respect that ordering.
    const board = BOARDS.find((b) => b.id === 'most_productive');
    const currentStanding = computeBoardStanding(board, data, profile, NOW);

    const priorPosts = [
      // Newest → matches current rank → should suppress
      {
        createdAt: '2026-05-25T10:30:00Z',
        leaderboard: { boardId: 'most_productive', userRank: currentStanding.userRank, entries: [] },
      },
      // Older → different rank → must NOT be considered
      {
        createdAt: '2026-05-24T10:00:00Z',
        leaderboard: { boardId: 'most_productive', userRank: 5, entries: [] },
      },
    ];

    // Lock all OTHER boards at current rank so only most_productive is in play.
    const lockOthers = BOARDS.filter((b) => b.id !== 'most_productive').map((b) => {
      const s = computeBoardStanding(b, data, profile, NOW);
      return {
        createdAt: '2026-05-25T10:00:00Z',
        leaderboard: { boardId: b.id, userRank: s.userRank, entries: [] },
      };
    });

    const result = pickBoardToPost(data, profile, [...priorPosts, ...lockOthers], NOW);
    expect(result).toBeNull();
  });

  it('picks the board with the LARGER rank delta when multiple boards changed', () => {
    // Manufacture prior posts so most_productive shows delta=4 and every other
    // board shows delta=1; the dispatch logic must pick most_productive even though
    // priority ties would otherwise favor it on equal deltas.
    const targetBoardId = 'most_productive';
    const priorPosts = BOARDS.map((b) => {
      const s = computeBoardStanding(b, data, profile, NOW);
      if (b.id === targetBoardId) {
        // Force a 4-position swap: if currentRank is 1, prior was 5; otherwise prior was 1.
        const fakePrev = s.userRank === 1 ? 5 : 1;
        return {
          createdAt: '2026-05-25T10:00:00Z',
          leaderboard: { boardId: b.id, userRank: fakePrev, entries: [] },
        };
      }
      // For all others: store a prior rank exactly 1 away (or wrap 5→4)
      const fakePrev = s.userRank === 5 ? 4 : s.userRank + 1;
      return {
        createdAt: '2026-05-25T10:00:00Z',
        leaderboard: { boardId: b.id, userRank: fakePrev, entries: [] },
      };
    });

    const result = pickBoardToPost(data, profile, priorPosts, NOW);
    expect(result).not.toBeNull();
    expect(result.board.id).toBe(targetBoardId);
  });
});
