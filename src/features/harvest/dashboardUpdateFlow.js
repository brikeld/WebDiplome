export const DASHBOARD_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

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
