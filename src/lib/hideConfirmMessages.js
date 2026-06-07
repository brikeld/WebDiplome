/** Shared hide / unhide confirm copy and score-restore labels. */

export function formatRestorePointsLabel(systemDeltaPct) {
  const points = Math.abs(Number(systemDeltaPct) || 1);
  const restorePoints = points * 0.5;
  return restorePoints % 1 === 0
    ? String(restorePoints)
    : restorePoints.toFixed(1).replace(/\.0$/, '');
}

export function unhideConfirmTitle(leaderboard = false) {
  return leaderboard ? 'Unhide your ranking?' : 'Unhide this post?';
}

export function unhideConfirmCancelLabel(leaderboard = false) {
  return leaderboard ? 'Stay hidden' : 'Keep hidden';
}

export function unhideConfirmActionLabel(leaderboard = false) {
  return leaderboard ? 'Show ranking' : 'Unhide anyway';
}
