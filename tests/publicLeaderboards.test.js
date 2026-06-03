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

  it('returns only the top five rows when more than five real users exist', () => {
    const profiles = Array.from({ length: 7 }, (_, i) => ({
      slug: `user-${i + 1}`,
      displayName: `User ${i + 1}`,
      globalScore: 10 + i,
      personaScores: {
        productivity: 10 + i,
        security: 10 + i,
        social: 10 + i,
      },
    }));

    const boards = buildPublicLeaderboards(profiles, 5, {
      nowMs: new Date('2026-06-03T12:00:00Z').getTime(),
    });

    for (const board of boards) {
      expect(board.entries).toHaveLength(5);
      expect(board.entries.every((entry) => entry.source === 'real')).toBe(true);
      expect(board.entries.some((entry) => entry.slug === 'user-1')).toBe(false);
    }
  });

  it('lets a new real user enter the top five by score instead of insertion order', () => {
    const profiles = [
      { slug: 'low-1', displayName: 'Low 1', globalScore: 11, personaScores: { productivity: 11, security: 11, social: 11 } },
      { slug: 'low-2', displayName: 'Low 2', globalScore: 12, personaScores: { productivity: 12, security: 12, social: 12 } },
      { slug: 'mid-1', displayName: 'Mid 1', globalScore: 50, personaScores: { productivity: 50, security: 50, social: 50 } },
      { slug: 'mid-2', displayName: 'Mid 2', globalScore: 55, personaScores: { productivity: 55, security: 55, social: 55 } },
      { slug: 'mid-3', displayName: 'Mid 3', globalScore: 60, personaScores: { productivity: 60, security: 60, social: 60 } },
      { slug: 'winner', displayName: 'Winner', globalScore: 99, personaScores: { productivity: 99, security: 99, social: 99 } },
    ];

    const [board] = buildPublicLeaderboards(profiles, 5, {
      nowMs: new Date('2026-06-03T12:00:00Z').getTime(),
    });

    expect(board.entries).toHaveLength(5);
    expect(board.entries[0].slug).toBe('winner');
    expect(board.entries.some((entry) => entry.slug === 'low-1')).toBe(false);
  });
});
