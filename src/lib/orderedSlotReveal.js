/**
 * Buffer streamed posts by slot index and release them in plan order so the feed
 * reveal sequence matches the pre-computed persona plan.
 */
export function createOrderedSlotRevealBuffer({ plan = [], onRelease, onActiveSlotChange }) {
  const planBySlot = new Map(
    (Array.isArray(plan) ? plan : []).map((entry) => [entry.slotIndex, entry]),
  );
  const slotIndices = [...planBySlot.keys()].sort((a, b) => a - b);
  const maxSlot = slotIndices.length ? slotIndices[slotIndices.length - 1] : -1;
  const buffer = new Map();
  let nextSlot = slotIndices.length ? slotIndices[0] : 0;

  const emitActive = () => {
    const active = planBySlot.get(nextSlot);
    onActiveSlotChange?.(active?.persona ?? null, nextSlot);
  };

  const drain = () => {
    while (buffer.has(nextSlot)) {
      const post = buffer.get(nextSlot);
      buffer.delete(nextSlot);
      onRelease?.(post, nextSlot);
      const current = nextSlot;
      const pos = slotIndices.indexOf(current);
      const next = pos >= 0 && pos < slotIndices.length - 1 ? slotIndices[pos + 1] : maxSlot + 1;
      nextSlot = next;
      if (nextSlot > maxSlot) {
        onActiveSlotChange?.(null, nextSlot);
      } else {
        emitActive();
      }
    }
  };

  emitActive();

  return {
    setPlan(slots) {
      planBySlot.clear();
      for (const entry of Array.isArray(slots) ? slots : []) {
        planBySlot.set(entry.slotIndex, entry);
      }
      const ordered = [...planBySlot.keys()].sort((a, b) => a - b);
      nextSlot = ordered.length ? ordered[0] : 0;
      emitActive();
      drain();
    },
    push(post, slotIndex) {
      if (!post || typeof slotIndex !== 'number') return;
      buffer.set(slotIndex, post);
      drain();
    },
  };
}

export function personaAfterReveal(plan, revealedCount) {
  if (!Array.isArray(plan) || plan.length === 0) return null;
  const ordered = [...plan].sort((a, b) => a.slotIndex - b.slotIndex);
  return ordered[revealedCount]?.persona ?? null;
}
