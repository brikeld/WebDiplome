import { describe, expect, it } from 'vitest';
import { buildPublicLeaderboards } from '../server/lib/publicLeaderboards.js';

describe('buildPublicLeaderboards', () => {
  it('uses real profiles first and pads with demo rows only below five people', () => {
    const boards = buildPublicLeaderboards([
      { slug: 'ada', displayName: 'Ada', globalScore: 91, personaScores: { productivity: 80, security: 60, social: 50 } },
      { slug: 'grace', displayName: 'Grace', globalScore: 75, personaScores: { productivity: 60, security: 80, social: 40 } },
    ]);
    expect(boards[0].entries).toHaveLength(5);
    expect(boards[0].entries[0].source).toBe('real');
    expect(boards[0].entries.some((e) => e.source === 'bot')).toBe(true);
  });
});
