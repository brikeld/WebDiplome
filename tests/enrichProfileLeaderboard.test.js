import { describe, expect, it } from 'vitest';
import { enrichProfileLeaderboardForRationale } from '../src/lib/enrichProfileLeaderboard.js';

const board = {
  boardId: 'most_productive',
  title: 'Most Productive',
  userRank: 2,
  hint: 'Work apps dominated the week.',
  entries: [
    { rank: 1, name: 'Ada', source: 'real', isUser: false, score: 90 },
    { rank: 2, name: 'Bob', source: 'real', isUser: true, score: 88 },
    { rank: 3, name: 'Clone', source: 'bot', isUser: false, score: 70 },
  ],
};

describe('enrichProfileLeaderboardForRationale', () => {
  it('adds rationales and climb tip when missing', () => {
    const enriched = enrichProfileLeaderboardForRationale(board);
    expect(Array.isArray(enriched.rationales)).toBe(true);
    expect(enriched.rationales).toHaveLength(3);
    expect(enriched.rationales[1].rank).toBe(2);
    expect(typeof enriched.climbTip).toBe('string');
    expect(enriched.climbTip.length).toBeGreaterThan(10);
  });

  it('preserves stored rationales on posts synced to profile boards', () => {
    const stored = {
      ...board,
      rationales: [{ rank: 2, phrase: 'custom phrase', signal: 'x' }],
      climbTip: 'Custom tip.',
    };
    const enriched = enrichProfileLeaderboardForRationale(stored);
    expect(enriched.rationales[0].phrase).toBe('custom phrase');
    expect(enriched.climbTip).toBe('Custom tip.');
  });
});
