import { describe, it, expect } from 'vitest';
import { buildThreadComments } from '../src/features/commenting/threadComments.js';
import { getMockCommentsFor } from '../src/features/commenting/commentingMock.js';

const EMBEDDED = [
  { id: 'e1', persona: 'popularite', content: 'Embedded one', displayName: 'Léa Bernard' },
  { id: 'e2', persona: 'securite', content: 'Embedded two', displayName: 'Hugo Petit' },
];

describe('buildThreadComments', () => {
  it('uses embedded comments and skips the generic mock when present', () => {
    const out = buildThreadComments({ id: 'p1', comments: EMBEDDED }, null, getMockCommentsFor);
    expect(out).toHaveLength(2);
    expect(out.every((c) => c.displayName !== 'Alex Johnson')).toBe(true);
  });

  it('falls back to the mock when no embedded comments exist', () => {
    const out = buildThreadComments({ id: 'p1', comments: null }, null, getMockCommentsFor);
    expect(out).toHaveLength(1);
    expect(out[0].displayName).toBe('Alex Johnson');
  });

  it('appends persisted real comments after embedded ones', () => {
    const real = [{ id: 'r1', persona: 'popularite', content: 'From API' }];
    const out = buildThreadComments({ id: 'p1', comments: EMBEDDED }, real, getMockCommentsFor);
    expect(out.map((c) => c.id)).toEqual(['e1', 'e2', 'r1']);
  });

  it('tolerates empty embedded array (treated as absent)', () => {
    const out = buildThreadComments({ id: 'p1', comments: [] }, null, getMockCommentsFor);
    expect(out[0].displayName).toBe('Alex Johnson');
  });
});
