import { describe, expect, it } from 'vitest';
import { cloneHiddenForBoard, FAKE_CLONE_COUNT } from '../server/lib/leaderboards.js';

describe('cloneHiddenForBoard', () => {
  it('returns one boolean per clone', () => {
    const out = cloneHiddenForBoard('most_productive');
    expect(out).toHaveLength(FAKE_CLONE_COUNT);
    out.forEach((v) => expect(typeof v).toBe('boolean'));
  });

  it('is deterministic for the same boardId', () => {
    expect(cloneHiddenForBoard('most_secure')).toEqual(cloneHiddenForBoard('most_secure'));
  });

  it('varies between boards (at least two distinct masks across all 7)', () => {
    const ids = [
      'most_productive', 'closest_to_burnout', 'most_likely_change_jobs',
      'ignoring_health', 'most_secure', 'most_socially_isolated', 'most_likely_ghost',
    ];
    const masks = new Set(ids.map((id) => cloneHiddenForBoard(id).join(',')));
    expect(masks.size).toBeGreaterThanOrEqual(2);
  });

  it('hides roughly 1 in 4 clones across all 7 boards (>0, <FAKE_CLONE_COUNT*7)', () => {
    const ids = [
      'most_productive', 'closest_to_burnout', 'most_likely_change_jobs',
      'ignoring_health', 'most_secure', 'most_socially_isolated', 'most_likely_ghost',
    ];
    const total = ids.reduce((acc, id) => acc + cloneHiddenForBoard(id).filter(Boolean).length, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(FAKE_CLONE_COUNT * ids.length);
  });
});
