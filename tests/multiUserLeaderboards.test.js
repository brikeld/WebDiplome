import { describe, expect, it } from 'vitest';
import {
  buildMultiUserLeaderboards,
  dedupeProfilesForLeaderboards,
} from '../server/lib/multiUserLeaderboards.js';

describe('buildMultiUserLeaderboards', () => {
  const ada = {
    slug: 'ada-demo',
    firstname: 'Ada',
    lastname: 'Lovelace',
    globalScore: 91,
    personaScores: { productivity: 80, security: 60, social: 50 },
  };
  const grace = {
    slug: 'grace-demo',
    firstname: 'Grace',
    lastname: 'Hopper',
    globalScore: 75,
    personaScores: { productivity: 60, security: 80, social: 40 },
  };

  it('includes all real users and pads with bots up to five rows', () => {
    const boards = buildMultiUserLeaderboards([ada, grace], { viewerSlug: 'ada-demo' });
    expect(boards.length).toBeGreaterThan(0);
    const board = boards[0];
    expect(board.entries).toHaveLength(5);
    expect(board.entries.filter((e) => e.source === 'real')).toHaveLength(2);
    expect(board.entries.filter((e) => e.source === 'bot')).toHaveLength(3);
    expect(board.entries.some((e) => e.isUser && e.name.includes('Ada'))).toBe(true);
  });

  it('marks an entry selfHidden when that profile hid its position on the board', () => {
    const boardId = buildMultiUserLeaderboards([ada, grace])[0].boardId;
    const adaHidden = {
      ...ada,
      liveScoringRecords: {
        [`leaderboard-self|${boardId}`]: { restorable: 1, delta: -1 },
      },
    };
    const board = buildMultiUserLeaderboards([adaHidden, grace], { viewerSlug: 'grace-demo' })
      .find((b) => b.boardId === boardId);
    expect(board.entries.find((e) => e.name.includes('Ada')).selfHidden).toBe(true);
    expect(board.entries.find((e) => e.name.includes('Grace')).selfHidden).toBe(false);

    // A revealed (restorable 0) record does not hide the row.
    const adaRevealed = {
      ...ada,
      liveScoringRecords: { [`leaderboard-self|${boardId}`]: { restorable: 0 } },
    };
    const revealed = buildMultiUserLeaderboards([adaRevealed, grace], { viewerSlug: 'grace-demo' })
      .find((b) => b.boardId === boardId);
    expect(revealed.entries.find((e) => e.name.includes('Ada')).selfHidden).toBe(false);
  });

  it('drops bots when five or more real users exist', () => {
    const extras = [3, 4, 5].map((n) => ({
      slug: `user-${n}`,
      firstname: `User${n}`,
      lastname: 'Test',
      globalScore: 50 + n,
      personaScores: { productivity: 50, security: 50, social: 50 },
    }));
    const boards = buildMultiUserLeaderboards([ada, grace, ...extras]);
    expect(boards[0].entries).toHaveLength(5);
    expect(boards[0].entries.every((e) => e.source === 'real')).toBe(true);
  });

  it('dedupes the same person when machine_name repeats (re-sync / second signup)', () => {
    const older = {
      slug: 'brikeld-hoxha-aaaa1111',
      firstname: 'Brikeld',
      lastname: 'Hoxha',
      machineName: 'MacBook-Air',
      updated_at: '2026-01-01T00:00:00.000Z',
      globalScore: 70,
      personaScores: { productivity: 70, security: 60, social: 50 },
    };
    const newer = {
      slug: 'brikeld-hoxha-bbbb2222',
      firstname: 'Brikeld',
      lastname: 'Hoxha',
      machineName: 'MacBook-Air',
      updated_at: '2026-06-01T00:00:00.000Z',
      globalScore: 80,
      personaScores: { productivity: 75, security: 65, social: 55 },
    };
    const deduped = dedupeProfilesForLeaderboards([older, newer, grace]);
    expect(deduped.filter((p) => p.firstname === 'Brikeld')).toHaveLength(1);
    expect(deduped.find((p) => p.firstname === 'Brikeld')?.slug).toBe('brikeld-hoxha-bbbb2222');

    const boards = buildMultiUserLeaderboards([older, newer, grace], { viewerSlug: 'brikeld-hoxha-bbbb2222' });
    const names = boards[0].entries.filter((e) => e.source === 'real').map((e) => e.name);
    expect(names.filter((n) => n.includes('Brikeld'))).toHaveLength(1);
  });

  it('replaces bot slots as new real users join', () => {
    const twoUsers = buildMultiUserLeaderboards([ada, grace]);
    const threeUsers = buildMultiUserLeaderboards([ada, grace, {
      slug: 'linus',
      firstname: 'Linus',
      lastname: 'T',
      globalScore: 70,
      personaScores: { productivity: 70, security: 55, social: 45 },
    }]);
    expect(twoUsers[0].entries.filter((e) => e.source === 'bot')).toHaveLength(3);
    expect(threeUsers[0].entries.filter((e) => e.source === 'bot')).toHaveLength(2);
  });
});
