import { slugsReferToSameAccount } from '@/lib/accountDeletionClient.js';

/** Stable key for an author's self-hide (visible to everyone via author liveScoringRecords). */
export function normalizePostHideKey(createdAt) {
  if (createdAt == null) return '';
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) return String(createdAt);
  if (createdAt instanceof Date) {
    const t = createdAt.getTime();
    return Number.isFinite(t) ? String(t) : '';
  }
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) ? String(t) : String(createdAt);
}

/** @deprecated alias — prefer normalizePostHideKey for author-global hide */
export const authorPostHideKey = normalizePostHideKey;

/** Viewer-only hide of another user's post (never synced to the author's profile). */
export function viewerPostHideKey(authorSlug, createdAt) {
  const author = String(authorSlug ?? '').trim();
  const ts = normalizePostHideKey(createdAt);
  if (!author || !ts) return '';
  return `viewer-hide|${author}|${ts}`;
}

export function isOwnAuthorPost(post, viewerSlug) {
  const author = String(post?.authorSlug ?? '').trim();
  const viewer = String(viewerSlug ?? '').trim();
  if (!author || !viewer) return false;
  return author === viewer || slugsReferToSameAccount(author, viewer);
}

/**
 * Storage key in the logged-in viewer's liveScoring records for hide/reveal.
 * Own posts use the author-global key; other users' posts use a viewer-scoped key.
 */
export function resolveViewerHideStorageKey(post, viewerSlug) {
  const authorKey = normalizePostHideKey(post?.createdAt);
  if (!authorKey) return '';
  if (isOwnAuthorPost(post, viewerSlug)) return authorKey;
  return viewerPostHideKey(post?.authorSlug, post?.createdAt);
}
