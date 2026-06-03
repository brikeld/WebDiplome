import { isLeaderboardBotEntry } from '@/lib/leaderboardEntryVisibility.js';

function slugInDirectory(slug, directorySlugs) {
  if (!slug) return false;
  const set = directorySlugs instanceof Set
    ? directorySlugs
    : new Set(
        (Array.isArray(directorySlugs) ? directorySlugs : [])
          .map((s) => String(s ?? '').trim())
          .filter(Boolean),
      );
  return set.has(String(slug));
}

/** Slug for a leaderboard row that maps to a live profile in the directory. */
export function leaderboardEntryProfileSlug(entry, authorSlug = null, directorySlugs = null) {
  if (!entry || isLeaderboardBotEntry(entry)) return null;

  if (entry.isUser) {
    const author = authorSlug != null ? String(authorSlug).trim() : '';
    if (!author) return null;
    if (directorySlugs != null && !slugInDirectory(author, directorySlugs)) return null;
    return author;
  }

  const slug = entry.slug != null ? String(entry.slug).trim() : '';
  if (!slug || slug.startsWith('demo-')) return null;
  if (directorySlugs != null && !slugInDirectory(slug, directorySlugs)) return null;
  return slug;
}
