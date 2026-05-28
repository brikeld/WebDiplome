import { useEffect, useState } from 'react';

export const PROFILE_TAB_EXIT_MS = 360;
export const PROFILE_TAB_ENTER_MS = 560;

function getDurations() {
  if (typeof window === 'undefined') {
    return { exitMs: PROFILE_TAB_EXIT_MS, enterMs: PROFILE_TAB_ENTER_MS };
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { exitMs: 0, enterMs: 0 };
  }
  return { exitMs: PROFILE_TAB_EXIT_MS, enterMs: PROFILE_TAB_ENTER_MS };
}

/**
 * Delays swapping tab panel content until the exit animation finishes.
 * @returns {{ displayTab: string, phase: 'visible' | 'exit' | 'enter' }}
 */
export function useProfileTabTransition(activeTab) {
  const [displayTab, setDisplayTab] = useState(activeTab);
  const [phase, setPhase] = useState('visible');

  useEffect(() => {
    if (activeTab === displayTab) return undefined;

    const { exitMs } = getDurations();
    setPhase('exit');

    const exitTimer = setTimeout(() => {
      setDisplayTab(activeTab);
      setPhase('enter');
    }, exitMs);

    return () => clearTimeout(exitTimer);
  }, [activeTab, displayTab]);

  useEffect(() => {
    if (phase !== 'enter') return undefined;

    const { enterMs } = getDurations();
    const enterTimer = setTimeout(() => setPhase('visible'), enterMs);
    return () => clearTimeout(enterTimer);
  }, [phase, displayTab]);

  return { displayTab, phase };
}
