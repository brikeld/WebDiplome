import { describe, expect, it } from 'vitest';
import {
  applyLeaderboardSelfHide,
  applyLeaderboardSelfReveal,
  isLeaderboardSelfHidden,
  leaderboardSelfKey,
  computeLiveAdjustments,
} from '../src/features/liveScoring/scoringLogic.js';

describe('leaderboardSelfKey', () => {
  it('is stable per boardId', () => {
    expect(leaderboardSelfKey('most_productive')).toBe('leaderboard-self|most_productive');
  });

  it('cannot collide with a numeric postKey', () => {
    expect(leaderboardSelfKey('most_productive')).not.toMatch(/^\d+$/);
  });
});

describe('applyLeaderboardSelfHide', () => {
  it('adds a record keyed by leaderboardSelfKey', () => {
    const records = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 2);
    expect(records['leaderboard-self|most_secure']).toBeDefined();
    expect(records['leaderboard-self|most_secure'].delta).toBe(-2);
    expect(records['leaderboard-self|most_secure'].persona).toBe('securite');
  });

  it('is a no-op if already hidden', () => {
    const r1 = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 2);
    const r2 = applyLeaderboardSelfHide(r1, 'most_secure', 'securite', 2);
    expect(r2).toBe(r1);
  });
});

describe('applyLeaderboardSelfReveal', () => {
  it('restores 50% to the persona axis (matches applyReveal semantics)', () => {
    const hidden = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 4);
    const adjBefore = computeLiveAdjustments(hidden);
    expect(adjBefore.security).toBe(-4);
    const revealed = applyLeaderboardSelfReveal(hidden, 'most_secure');
    const adjAfter = computeLiveAdjustments(revealed);
    expect(adjAfter.security).toBe(-2); // -4 + 2 (50% restorable)
  });

  it('is a no-op if not currently hidden', () => {
    const r1 = {};
    const r2 = applyLeaderboardSelfReveal(r1, 'most_secure');
    expect(r2).toBe(r1);
  });
});

describe('isLeaderboardSelfHidden', () => {
  it('returns true while the record has restorable points', () => {
    const hidden = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 4);
    expect(isLeaderboardSelfHidden(hidden, 'most_secure')).toBe(true);
  });

  it('returns false after reveal', () => {
    const hidden = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 4);
    const revealed = applyLeaderboardSelfReveal(hidden, 'most_secure');
    expect(isLeaderboardSelfHidden(revealed, 'most_secure')).toBe(false);
  });
});

describe('computeLiveAdjustments interop', () => {
  it('aggregates leaderboard-self records into the same triplet as post hides', () => {
    let records = {};
    records = applyLeaderboardSelfHide(records, 'most_productive', 'productivite', 3);
    records['1234567890'] = { persona: 'popularite', delta: -2, restorable: 1 }; // simulate post hide
    const adj = computeLiveAdjustments(records);
    expect(adj.productivity).toBe(-3);
    expect(adj.social).toBe(-2);
  });
});
