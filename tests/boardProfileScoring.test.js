import { describe, expect, it } from 'vitest';
import { BOARDS } from '../server/lib/leaderboards.js';
import { buildMultiUserLeaderboards } from '../server/lib/multiUserLeaderboards.js';
import {
  harvestHasLeaderboardSignals,
  resolveProfileHarvestForScoring,
  scoreProfileFromPublicFields,
} from '../server/lib/boardProfileScoring.js';

const FIVE_USERS = [
  {
    slug: 'brikeld-hoxha',
    firstname: 'Brikeld',
    lastname: 'Hoxha',
    machineName: 'brikeld-mbp',
    globalScore: 82,
    personaScores: { productivity: 88, security: 72, social: 55 },
    dominantPersona: 'productivity',
    updated_at: '2026-06-01T10:00:00.000Z',
    collected_at: '2026-05-20T08:00:00.000Z',
  },
  {
    slug: 'janathan-demo',
    firstname: 'Janathan',
    lastname: 'K',
    machineName: 'janathan-air',
    globalScore: 78,
    personaScores: { productivity: 70, security: 80, social: 62 },
    dominantPersona: 'security',
    updated_at: '2026-06-02T11:00:00.000Z',
    collected_at: '2026-05-18T09:00:00.000Z',
  },
  {
    slug: 'nyria-demo',
    firstname: 'Nyria',
    lastname: 'L',
    machineName: 'nyria-pro',
    globalScore: 74,
    personaScores: { productivity: 65, security: 68, social: 78 },
    dominantPersona: 'popularity',
    updated_at: '2026-05-30T14:00:00.000Z',
    collected_at: '2026-05-15T12:00:00.000Z',
  },
  {
    slug: 'lea-demo',
    firstname: 'Léa',
    lastname: 'M',
    machineName: 'lea-studio',
    globalScore: 71,
    personaScores: { productivity: 60, security: 74, social: 70 },
    dominantPersona: 'security',
    updated_at: '2026-05-28T16:00:00.000Z',
    collected_at: '2026-05-10T10:00:00.000Z',
  },
  {
    slug: 'daniel-demo',
    firstname: 'Daniel',
    lastname: 'R',
    machineName: 'daniel-mac',
    globalScore: 68,
    personaScores: { productivity: 58, security: 62, social: 66 },
    dominantPersona: 'productivity',
    updated_at: '2026-05-25T08:00:00.000Z',
    collected_at: '2026-05-08T07:00:00.000Z',
  },
];

function realNameOrder(board) {
  return board.entries
    .filter((e) => e.source === 'real')
    .map((e) => e.name);
}

describe('boardProfileScoring', () => {
  it('ignores slim raw_profile without harvest signals', () => {
    const slim = {
      firstname: 'Ada',
      lastname: 'Lovelace',
      machineName: 'ada-mbp',
      lastHarvestDataJson: null,
    };
    expect(harvestHasLeaderboardSignals(slim)).toBe(false);
    expect(resolveProfileHarvestForScoring({ _harvest: slim })).toBeNull();
  });

  it('uses nested lastHarvestDataJson when present', () => {
    const harvest = {
      MACHINE_IDENTITY: { installed_apps: ['Cursor', 'NordVPN'] },
      PAST_HISTORY: {
        app_usage_7days: [{ app: 'Cursor', last_used: '2026-05-25T10:00:00Z' }],
        recent_files_7days: [],
        wifi_history: ['Home'],
        browser_history: { chrome: [], safari: [] },
      },
    };
    const profile = { _harvest: { firstname: 'Ada', lastHarvestDataJson: harvest } };
    expect(resolveProfileHarvestForScoring(profile)).toEqual(harvest);
  });

  it('produces different scores per board for the same profile', () => {
    const profile = FIVE_USERS[0];
    const scores = BOARDS.map((board) =>
      scoreProfileFromPublicFields(board, profile, Date.parse('2026-06-03T12:00:00.000Z')).score,
    );
    const unique = new Set(scores.map((s) => Math.round(s * 10) / 10));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('shifts score when profile updated_at changes', () => {
    const board = BOARDS[0];
    const before = scoreProfileFromPublicFields(board, FIVE_USERS[0], Date.parse('2026-06-03T12:00:00.000Z')).score;
    const after = scoreProfileFromPublicFields(
      board,
      { ...FIVE_USERS[0], updated_at: '2026-06-04T18:00:00.000Z' },
      Date.parse('2026-06-03T12:00:00.000Z'),
    ).score;
    expect(after).not.toBe(before);
  });
});

describe('buildMultiUserLeaderboards ranking diversity', () => {
  const nowMs = Date.parse('2026-06-03T15:00:00.000Z');

  it('does not use identical real-user order on every board', () => {
    const boards = buildMultiUserLeaderboards(FIVE_USERS, { nowMs });
    const orders = boards.map(realNameOrder);
    const serialized = orders.map((o) => o.join('|'));
    const uniqueOrders = new Set(serialized);
    expect(uniqueOrders.size).toBeGreaterThan(1);
  });

  it('recalculates standings when a new user joins', () => {
    const before = realNameOrder(buildMultiUserLeaderboards(FIVE_USERS, { nowMs })[0]);
    const newcomer = {
      slug: 'new-user',
      firstname: 'New',
      lastname: 'User',
      machineName: 'new-mac',
      globalScore: 95,
      personaScores: { productivity: 92, security: 90, social: 88 },
      updated_at: '2026-06-03T14:00:00.000Z',
    };
    const after = realNameOrder(
      buildMultiUserLeaderboards([...FIVE_USERS, newcomer], { nowMs })[0],
    );
    expect(after).toContain('New User');
    expect(after.join('|')).not.toBe(before.join('|'));
  });

  it('recalculates standings when a user updates profile data', () => {
    const boardId = 'most_secure';
    const before = buildMultiUserLeaderboards(FIVE_USERS, { nowMs })
      .find((b) => b.boardId === boardId);
    const updatedUsers = FIVE_USERS.map((u) =>
      u.slug === 'daniel-demo'
        ? {
            ...u,
            personaScores: { productivity: 90, security: 95, social: 40 },
            globalScore: 91,
            updated_at: '2026-06-03T16:30:00.000Z',
          }
        : u,
    );
    const after = buildMultiUserLeaderboards(updatedUsers, { nowMs })
      .find((b) => b.boardId === boardId);
    const beforeDaniel = before.entries.find((e) => e.slug === 'daniel-demo')?.rank;
    const afterDaniel = after.entries.find((e) => e.slug === 'daniel-demo')?.rank;
    expect(beforeDaniel).not.toBe(afterDaniel);
  });
});
