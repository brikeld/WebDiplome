import { remixStoredLeaderboard } from '../../server/lib/multiUserLeaderboards.js';
import { filterProfilesNotDeleted } from '@/lib/accountDeletionClient.js';
import { isLeaderboardBotEntry } from '@/lib/leaderboardEntryVisibility.js';

function directorySlugSet(directory) {
  const set = new Set();
  for (const profile of Array.isArray(directory) ? directory : []) {
    const slug = profile?.slug ?? profile?.id ?? null;
    if (slug) set.add(String(slug));
  }
  return set;
}

/** Drop real-user rows that no longer exist in the public profile directory. */
export function filterLeaderboardEntriesToDirectory(entries, directory) {
  const validSlugs = directorySlugSet(directory);
  const list = Array.isArray(entries) ? entries : [];
  return list.filter((entry) => {
    if (!entry || isLeaderboardBotEntry(entry)) return true;
    const slug = entry.slug != null ? String(entry.slug).trim() : '';
    if (!slug || slug.startsWith('demo-')) return false;
    return validSlugs.has(slug);
  });
}

/**
 * Rebuild a stored post leaderboard from the current user directory only.
 * Never falls back to baked-in names from deleted accounts.
 */
export function resolveLeaderboardForFeed(
  leaderboard,
  directory,
  authorSlug,
  deletedProfileIds = [],
) {
  if (!leaderboard?.boardId) return leaderboard;
  const filteredDirectory = filterProfilesNotDeleted(
    Array.isArray(directory) ? directory : [],
    deletedProfileIds,
  );
  const remixed = remixStoredLeaderboard(leaderboard, filteredDirectory, authorSlug);
  const entries = filterLeaderboardEntriesToDirectory(remixed.entries, filteredDirectory);
  if (entries.length >= 5) {
    return { ...remixed, entries };
  }
  const rebuilt = remixStoredLeaderboard(
    { boardId: leaderboard.boardId, title: leaderboard.title, persona: leaderboard.persona },
    filteredDirectory,
    authorSlug,
  );
  return rebuilt;
}
