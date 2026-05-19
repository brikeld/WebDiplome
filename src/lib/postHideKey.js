/** Stable Set key for hide/show toggle (createdAt may be number, ISO string, or Date). */
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
