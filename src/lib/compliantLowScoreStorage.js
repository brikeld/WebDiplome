const LS_PREFIX = 'compliant-low-score-fired|';

function storageKey(profileId) {
  return `${LS_PREFIX}${profileId}`;
}

export function loadLowScoreFiredPersonas(profileId) {
  if (!profileId) return [];
  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function markLowScoreFired(profileId, uiPersonaKey) {
  if (!profileId || !uiPersonaKey) return;
  const prev = loadLowScoreFiredPersonas(profileId);
  if (prev.includes(uiPersonaKey)) return;
  try {
    localStorage.setItem(
      storageKey(profileId),
      JSON.stringify([...prev, uiPersonaKey]),
    );
  } catch {
    /* ignore */
  }
}

export function clearLowScoreFiredForProfile(profileId) {
  if (!profileId) return;
  try {
    localStorage.removeItem(storageKey(profileId));
  } catch {
    /* ignore */
  }
}
