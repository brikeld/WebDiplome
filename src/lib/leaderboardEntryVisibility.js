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
 * @param {{ selfHidden: boolean, cloneHidden: boolean[], botIdx: { n: number } }} ctx
 */
export function isLeaderboardEntryPositionHidden(entry, { selfHidden, cloneHidden, botIdx }) {
  if (entry.isUser) return selfHidden;
  if (!isLeaderboardBotEntry(entry)) return false;
  botIdx.n += 1;
  return Boolean(cloneHidden[botIdx.n]);
}

export function mapLeaderboardEntryHiddenFlags(entries, { selfHidden, cloneHidden = [] }) {
  const botIdx = { n: -1 };
  return (Array.isArray(entries) ? entries : []).map((e) =>
    isLeaderboardEntryPositionHidden(e, { selfHidden, cloneHidden, botIdx }),
  );
}
