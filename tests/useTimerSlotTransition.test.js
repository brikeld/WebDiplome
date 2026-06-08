import { describe, expect, it } from 'vitest';
import { resolveUpdateFlowSlotKey } from '../src/features/harvest/useTimerSlotTransition.js';

describe('resolveUpdateFlowSlotKey', () => {
  it('returns null while a hide confirm overlay is visible', () => {
    expect(
      resolveUpdateFlowSlotKey({ actionSlot: 'timer' }, true),
    ).toBeNull();
  });

  it('maps update-flow action slots', () => {
    expect(resolveUpdateFlowSlotKey({ actionSlot: 'timer' }, false)).toBe('timer');
    expect(resolveUpdateFlowSlotKey({ actionSlot: 'harvest' }, false)).toBe('harvest');
    expect(resolveUpdateFlowSlotKey({ actionSlot: 'deltas' }, false)).toBe('deltas');
    expect(resolveUpdateFlowSlotKey({ actionSlot: 'generating' }, false)).toBe('generating');
  });
});
