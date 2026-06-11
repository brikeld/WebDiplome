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
 * Row hidden when:
 *   - `entry.selfHidden` — that real user globally hid their position (set by the
 *     server leaderboard builder from each profile's liveScoringRecords), OR
 *   - `viewerRowHidden` — viewer-local blur of their own row (by slug), OR
 *   - the entry is a bot whose `cloneHidden[]` slot is set.
 * Never blurs the post author via `isUser`.
 */
export function mapLeaderboardEntryHiddenFlags(
  entries,
  { viewerSlug = null, viewerRowHidden = false, cloneHidden = [] },
) {
  const botIdx = { n: -1 };
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    if (entry?.selfHidden) return true;
    if (viewerRowHidden && entryMatchesViewerSlug(entry, viewerSlug)) return true;
    return isLeaderboardEntryPositionHidden(entry, { cloneHidden, botIdx });
  });
}

export function isLeaderboardViewerRow(entry, viewerSlug) {
  return entryMatchesViewerSlug(entry, viewerSlug);
}
