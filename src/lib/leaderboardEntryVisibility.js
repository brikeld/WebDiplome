/**
 * Leaderboard row visibility: only bots may be "position hidden" via cloneHidden[].
 * Real users are always shown unless they hid themselves (handled separately for isUser).
 */

export function isLeaderboardBotEntry(entry) {
  if (!entry || entry.isUser) return false;
  if (entry.source === 'real') return false;
  if (entry.source === 'bot') return true;
  const slug = entry.slug != null ? String(entry.slug) : '';
  if (slug.startsWith('demo-')) return true;
  // Legacy single-user boards: non-user rows without source are fake clones.
  return entry.source == null;
}

/**
 * @param {object} entry
 * @param {{ cloneHidden: boolean[], botIdx: { n: number } }} ctx
 */
export function isLeaderboardEntryPositionHidden(entry, { cloneHidden, botIdx }) {
  if (!isLeaderboardBotEntry(entry)) return false;
  botIdx.n += 1;
  return Boolean(cloneHidden[botIdx.n]);
}

function entryMatchesViewerSlug(entry, viewerSlug) {
  const slug = String(entry?.slug ?? '').trim();
  const viewer = String(viewerSlug ?? '').trim();
  return Boolean(slug && viewer && slug === viewer && entry?.source === 'real');
}

/**
 * Viewer-local hide: blur only the logged-in user's row (by slug), never the post author via isUser.
 */
export function mapLeaderboardEntryHiddenFlags(
  entries,
  { viewerSlug = null, viewerRowHidden = false, cloneHidden = [] },
) {
  const botIdx = { n: -1 };
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    if (viewerRowHidden && entryMatchesViewerSlug(entry, viewerSlug)) return true;
    return isLeaderboardEntryPositionHidden(entry, { cloneHidden, botIdx });
  });
}

export function isLeaderboardViewerRow(entry, viewerSlug) {
  return entryMatchesViewerSlug(entry, viewerSlug);
}
