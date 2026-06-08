import { useEffect, useState } from 'react';

export const TIMER_SLOT_LEAVE_MS = 210;
export const TIMER_SLOT_ENTER_MS = 460;

const UPDATE_FLOW_SLOTS = new Set(['timer', 'harvest', 'deltas', 'generating']);

export function resolveUpdateFlowSlotKey(layout, inConfirmOverlay) {
  if (inConfirmOverlay) return null;
  const slot = layout?.actionSlot ?? 'timer';
  return UPDATE_FLOW_SLOTS.has(slot) ? slot : 'timer';
}

function getDurations() {
  if (typeof window === 'undefined') {
    return { leaveMs: TIMER_SLOT_LEAVE_MS, enterMs: TIMER_SLOT_ENTER_MS };
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { leaveMs: 0, enterMs: 0 };
  }
  return { leaveMs: TIMER_SLOT_LEAVE_MS, enterMs: TIMER_SLOT_ENTER_MS };
}

/**
 * Crossfades the dashboard update-flow timer slot (idle → harvest → deltas → generating).
 * @returns {{ displaySlot: string, phase: null | 'leaving' | 'entering' }}
 */
export function useTimerSlotTransition(targetSlotKey) {
  const [displaySlot, setDisplaySlot] = useState(() => targetSlotKey ?? 'timer');
  const [phase, setPhase] = useState(null);

  useEffect(() => {
    if (targetSlotKey === null) {
      setPhase(null);
      return undefined;
    }

    if (targetSlotKey === displaySlot) {
      return undefined;
    }

    const { leaveMs } = getDurations();
    if (leaveMs === 0) {
      setDisplaySlot(targetSlotKey);
      setPhase(null);
      return undefined;
    }

    setPhase('leaving');
    const leaveTimer = setTimeout(() => {
      setDisplaySlot(targetSlotKey);
      setPhase('entering');
    }, leaveMs);

    return () => clearTimeout(leaveTimer);
  }, [targetSlotKey, displaySlot]);

  useEffect(() => {
    if (phase !== 'entering') return undefined;

    const { enterMs } = getDurations();
    if (enterMs === 0) {
      setPhase(null);
      return undefined;
    }

    const enterTimer = setTimeout(() => setPhase(null), enterMs);
    return () => clearTimeout(enterTimer);
  }, [phase, displaySlot]);

  return { displaySlot, phase };
}
