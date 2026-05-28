const LS_PREFIX = 'live-scoring-';
export const ACCOUNT_DELETION_MARKER_KEY = 'webdiplome-last-account-deletion';

/** Remove hide/reveal score history for one profile id. */
export function clearLiveScoringForProfile(profileId) {
  if (!profileId) return;
  try {
    localStorage.removeItem(`${LS_PREFIX}${profileId}`);
  } catch {
    /* ignore */
  }
}

/** Remove all live-scoring-* keys (used after account delete). */
export function clearAllLiveScoringStorage() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(LS_PREFIX) || k.startsWith('compliant-low-score-fired|'))) {
        keys.push(k);
      }
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/**
 * When the server reports a newer account deletion than we've seen, wipe browser score history.
 * @returns {boolean} true if local state was cleared
 */
export function applyAccountDeletionFromServer(lastDeletionAt) {
  const ts = Number(lastDeletionAt) || 0;
  if (ts <= 0) return false;
  try {
    const prev = Number(localStorage.getItem(ACCOUNT_DELETION_MARKER_KEY) || 0);
    if (ts <= prev) return false;
    clearAllLiveScoringStorage();
    localStorage.setItem(ACCOUNT_DELETION_MARKER_KEY, String(ts));
    return true;
  } catch {
    return false;
  }
}
