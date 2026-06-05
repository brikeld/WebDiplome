import { describe, expect, it, vi } from 'vitest';
import {
  createOrderedSlotRevealBuffer,
  personaAfterReveal,
} from '../src/lib/orderedSlotReveal.js';

describe('orderedSlotReveal', () => {
  it('personaAfterReveal returns the nth planned persona', () => {
    const plan = [
      { slotIndex: 0, persona: 'productivite' },
      { slotIndex: 1, persona: 'securite' },
      { slotIndex: 2, persona: 'popularite' },
    ];
    expect(personaAfterReveal(plan, 0)).toBe('productivite');
    expect(personaAfterReveal(plan, 2)).toBe('popularite');
    expect(personaAfterReveal(plan, 3)).toBeNull();
  });

  it('releases buffered posts in slot order', () => {
    const released = [];
    const active = [];
    const buffer = createOrderedSlotRevealBuffer({
      plan: [
        { slotIndex: 0, persona: 'productivite' },
        { slotIndex: 1, persona: 'securite' },
      ],
      onRelease: (post, slotIndex) => released.push({ post, slotIndex }),
      onActiveSlotChange: (persona) => active.push(persona),
    });

    buffer.push({ content: 'second' }, 1);
    expect(released).toHaveLength(0);

    buffer.push({ content: 'first' }, 0);
    expect(released).toEqual([
      { post: { content: 'first' }, slotIndex: 0 },
      { post: { content: 'second' }, slotIndex: 1 },
    ]);
    expect(active[0]).toBe('productivite');
    expect(active.at(-1)).toBeNull();
  });
});
