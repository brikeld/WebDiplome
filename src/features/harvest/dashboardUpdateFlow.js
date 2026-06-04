export const DASHBOARD_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export function formatDashboardCountdown(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getDashboardTimerRingModel(
  remainingMs,
  intervalMs = DASHBOARD_UPDATE_INTERVAL_MS,
) {
  const safeInterval = Math.max(1, Number(intervalMs) || DASHBOARD_UPDATE_INTERVAL_MS);
  const clampedRemaining = Math.max(
    0,
    Math.min(safeInterval, Number(remainingMs) || 0),
  );
  const progress = clampedRemaining / safeInterval;

  return {
    outer: Math.round(55 + progress * 300),
    middle: Math.round(30 + progress * 240),
    inner: Math.round(5 + progress * 180),
  };
}

export function getDashboardCountdownNextRemaining(
  remainingMs,
  elapsedMs,
  { active = true, visible = true } = {},
) {
  const current = Math.max(0, Number(remainingMs) || 0);
  if (!active || !visible) return current;
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  return Math.max(0, current - elapsed);
}

export function shouldAutoTriggerDashboardUpdate({
  remainingMs,
  timerActive,
  accountFeaturesEnabled,
  postLoading,
  harvestPhase,
} = {}) {
  return (
    Math.max(0, Number(remainingMs) || 0) <= 0
    && timerActive === true
    && accountFeaturesEnabled === true
    && postLoading !== true
    && harvestPhase !== 'harvesting'
  );
}

export function getDashboardControlLayout({ harvestPhase, postPhase } = {}) {
  if (harvestPhase === 'harvesting') {
    return { actionSlot: 'harvest' };
  }
  if (postPhase === 'deltas') {
    return { actionSlot: 'deltas' };
  }
  if (postPhase === 'generating') {
    return { actionSlot: 'generating' };
  }
  return { actionSlot: 'timer' };
}
