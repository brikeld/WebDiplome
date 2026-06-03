/** Match deleted slugs to live profile rows (hosted suffix rows + local ids). */

export function profileSlugBase(slug) {
  const s = String(slug ?? '').trim().toLowerCase();
  if (!s) return '';
  const m = s.match(/^(.+)-[a-f0-9]{6,}$/i);
  return m ? m[1] : s;
}

export function slugsReferToSameAccount(a, b) {
  const left = String(a ?? '').trim();
  const right = String(b ?? '').trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const baseA = profileSlugBase(left);
  const baseB = profileSlugBase(right);
  return baseA !== '' && baseA === baseB;
}

export function isProfileSlugDeleted(slug, deletedProfileIds) {
  const needle = String(slug ?? '').trim();
  if (!needle || !Array.isArray(deletedProfileIds)) return false;
  return deletedProfileIds.some((id) => slugsReferToSameAccount(needle, id));
}

export function filterProfilesNotDeleted(profiles, deletedProfileIds) {
  const list = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  if (!Array.isArray(deletedProfileIds) || deletedProfileIds.length === 0) return list;
  return list.filter((p) => !isProfileSlugDeleted(p?.slug ?? p?.id, deletedProfileIds));
}
