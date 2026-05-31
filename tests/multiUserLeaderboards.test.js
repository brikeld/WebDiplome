import { describe, expect, it } from 'vitest';
import { buildMultiUserLeaderboards } from '../server/lib/multiUserLeaderboards.js';

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
