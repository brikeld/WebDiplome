import { isLeaderboardBotEntry } from '@/lib/leaderboardEntryVisibility.js';

/** Slug for a leaderboard row that maps to a real hosted/local profile, if any. */
export function leaderboardEntryProfileSlug(entry, authorSlug = null) {
  if (!entry || isLeaderboardBotEntry(entry)) return null;
  const slug = entry.slug != null ? String(entry.slug).trim() : '';
  if (slug && !slug.startsWith('demo-')) return slug;
  if (entry.isUser && authorSlug) {
    const author = String(authorSlug).trim();
    return author || null;
  }
  return null;
}
