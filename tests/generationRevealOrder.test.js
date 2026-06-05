import { describe, expect, it } from 'vitest';
import {
  stampPostForRevealSlot,
  stampPostsForRevealSlots,
} from '../server/lib/generationRevealOrder.js';

describe('generation reveal order timestamps', () => {
  it('stamps later slots as newer so canonical sorting matches reveal order', () => {
    const first = { content: 'first' };
    const second = { content: 'second' };

    stampPostForRevealSlot(first, 0, 1_700_000_000_000);
    stampPostForRevealSlot(second, 1, 1_700_000_000_000);

    expect(new Date(second.createdAt).getTime()).toBeGreaterThan(new Date(first.createdAt).getTime());
  });

  it('preserves null slots while stamping present posts', () => {
    const posts = [{ content: 'first' }, null, { content: 'third' }];

    expect(stampPostsForRevealSlots(posts, 1_700_000_000_000)).toEqual([
      { content: 'first', createdAt: '2023-11-14T22:13:20.000Z' },
      null,
      { content: 'third', createdAt: '2023-11-14T22:13:20.002Z' },
    ]);
  });
});
