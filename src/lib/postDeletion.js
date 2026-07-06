/** Remove one post (matched by author slug + createdAt) from profile state. */
export function stripPostFromProfile(profile, authorSlug, createdAt) {
  if (!profile || typeof profile !== 'object') return profile;
  const key = String(profile.slug ?? profile.id ?? '');
  if (key !== String(authorSlug)) return profile;
  const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
  const next = posts.filter(
    (p) => (p?.createdAt ?? p?.created_at) !== createdAt,
  );
  if (next.length === posts.length) return profile;
  return { ...profile, personaPosts: next };
}

export function removePostFromProfiles(profiles, authorSlug, createdAt) {
  return (Array.isArray(profiles) ? profiles : []).map(
    (p) => stripPostFromProfile(p, authorSlug, createdAt),
  );
}
