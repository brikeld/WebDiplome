function profileKey(profile) {
  const key = profile?.slug ?? profile?.id;
  return key == null || key === '' ? null : String(key);
}

export function mergeSummaryAndFeedProfiles(summaryProfiles, feedProfiles) {
  const byKey = new Map();
  const order = [];

  for (const profile of Array.isArray(summaryProfiles) ? summaryProfiles : []) {
    if (!profile || typeof profile !== 'object') continue;
    const key = profileKey(profile);
    if (!key) continue;
    byKey.set(key, { ...profile, personaPosts: [] });
    order.push(key);
  }

  for (const profile of Array.isArray(feedProfiles) ? feedProfiles : []) {
    if (!profile || typeof profile !== 'object') continue;
    const key = profileKey(profile);
    if (!key) continue;
    const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts.filter(Boolean) : [];
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, { ...existing, personaPosts: posts });
    } else {
      byKey.set(key, { ...profile, personaPosts: posts });
      order.push(key);
    }
  }

  return order.map((key) => byKey.get(key)).filter(Boolean);
}
