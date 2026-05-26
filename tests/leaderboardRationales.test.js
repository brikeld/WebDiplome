import { describe, expect, it } from 'vitest';
import {
  parseRationalesResponse,
  fallbackRationales,
  buildRationalesPayload,
} from '../server/lib/leaderboardRationales.js';

const STANDING = {
  entries: [
    { rank: 1, score: 61, isUser: false },
    { rank: 2, score: 55, isUser: false },
    { rank: 3, score: 47, isUser: true },
    { rank: 4, score: 40, isUser: false },
    { rank: 5, score: 30, isUser: false },
  ],
  hint: '4 work app(s), 2 creative app(s), 1 entertainment app(s) used recently.',
};
const CLONE_HIDDEN = [false, true, false, false]; // 4 clones; index 1 hidden
const BOARD = { id: 'most_productive', title: 'Top 5 Most Productive' };

describe('parseRationalesResponse', () => {
  it('accepts well-formed JSON with 5 entries', () => {
    const raw = JSON.stringify({
      rationales: [
        { rank: 1, phrase: 'shipping a lot', signal: 'score 61 · yours 47' },
        { rank: 2, phrase: null, signal: null },
        { rank: 3, phrase: 'late-night grind', signal: '4 work, 2 creative' },
        { rank: 4, phrase: 'mostly creative', signal: 'score 40 · yours 47' },
        { rank: 5, phrase: 'low effort today', signal: 'score 30 · yours 47' },
      ],
    });
    const out = parseRationalesResponse(raw);
    expect(out).toHaveLength(5);
    expect(out[0].phrase).toBe('shipping a lot');
    expect(out[1].phrase).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    expect(parseRationalesResponse('not json')).toBeNull();
    expect(parseRationalesResponse(JSON.stringify({ rationales: [] }))).toBeNull();
    expect(parseRationalesResponse(JSON.stringify({ rationales: new Array(4).fill({}) }))).toBeNull();
  });

  it('coerces ranks to ascending order if model returns shuffled', () => {
    const raw = JSON.stringify({
      rationales: [
        { rank: 3, phrase: 'c', signal: 's3' },
        { rank: 1, phrase: 'a', signal: 's1' },
        { rank: 5, phrase: 'e', signal: 's5' },
        { rank: 2, phrase: 'b', signal: 's2' },
        { rank: 4, phrase: 'd', signal: 's4' },
      ],
    });
    const out = parseRationalesResponse(raw);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(out.map((r) => r.phrase)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('truncates phrases over 90 chars', () => {
    const longPhrase = 'x'.repeat(200);
    const raw = JSON.stringify({
      rationales: [
        { rank: 1, phrase: longPhrase, signal: 's' },
        { rank: 2, phrase: 'ok', signal: 's' },
        { rank: 3, phrase: 'ok', signal: 's' },
        { rank: 4, phrase: 'ok', signal: 's' },
        { rank: 5, phrase: 'ok', signal: 's' },
      ],
    });
    const out = parseRationalesResponse(raw);
    expect(out[0].phrase.length).toBeLessThanOrEqual(90);
  });
});

describe('fallbackRationales', () => {
  it('emits 5 entries aligned with entries[]', () => {
    const out = fallbackRationales(BOARD, STANDING, CLONE_HIDDEN);
    expect(out).toHaveLength(5);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('uses selfPhrase for the user entry', () => {
    const out = fallbackRationales(BOARD, STANDING, CLONE_HIDDEN);
    expect(out[2].phrase).toBe('shipping more than you sleep'); // rank 3 = user
    expect(out[2].signal).toBe(STANDING.hint);
  });

  it('emits null phrase + null signal for hidden clones', () => {
    // CLONE_HIDDEN[1] = true means the 2nd clone (in clone order) is hidden.
    // Clones in rank order (skipping user at rank 3): rank 1, 2, 4, 5 → clone indices 0,1,2,3
    const out = fallbackRationales(BOARD, STANDING, CLONE_HIDDEN);
    expect(out[1].phrase).toBeNull(); // rank 2 = clone idx 1 = hidden
    expect(out[1].signal).toBeNull();
  });

  it('clone signals use "score N · yours M" format', () => {
    const out = fallbackRationales(BOARD, STANDING, CLONE_HIDDEN);
    expect(out[0].signal).toBe('score 61 · yours 47');
    expect(out[3].signal).toBe('score 40 · yours 47');
    expect(out[4].signal).toBe('score 30 · yours 47');
  });
});

describe('buildRationalesPayload', () => {
  it('includes board title, hint description, and 5 entries with hidden flag', () => {
    const payload = buildRationalesPayload(BOARD, STANDING, CLONE_HIDDEN);
    expect(payload).toContain('Top 5 Most Productive');
    expect(payload).toContain('4 work app');
    expect(payload).toContain('"hidden":true');
    expect((payload.match(/"rank":/g) || [])).toHaveLength(5);
  });
});
