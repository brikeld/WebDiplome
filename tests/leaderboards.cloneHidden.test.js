import { describe, expect, it } from 'vitest';
import { BOARDS, cloneHiddenForBoard, FAKE_CLONE_COUNT } from '../server/lib/leaderboards.js';

describe('cloneHiddenForBoard', () => {
  it('returns one boolean per clone', () => {
    const out = cloneHiddenForBoard('most_productive');
    expect(out).toHaveLength(FAKE_CLONE_COUNT);
    out.forEach((v) => expect(typeof v).toBe('boolean'));
  });

  it('is deterministic for the same boardId', () => {
    expect(cloneHiddenForBoard('most_secure')).toEqual(cloneHiddenForBoard('most_secure'));
  });

  it('varies between boards (at least two distinct masks across all boards)', () => {
    const ids = BOARDS.map((b) => b.id);
    const masks = new Set(ids.map((id) => cloneHiddenForBoard(id).join(',')));
    expect(masks.size).toBeGreaterThanOrEqual(2);
  });

  it('hides roughly 1 in 4 clones across all boards (>0, <FAKE_CLONE_COUNT * board count)', () => {
    const ids = BOARDS.map((b) => b.id);
    const total = ids.reduce((acc, id) => acc + cloneHiddenForBoard(id).filter(Boolean).length, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(FAKE_CLONE_COUNT * ids.length);
  });
});
