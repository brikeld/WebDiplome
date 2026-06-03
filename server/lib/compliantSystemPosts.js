/** Server-side COMPLIANT system posts (mirrors src/lib/compliantSystemPosts.js join/notice copy). */

export function hasCompliantJoinPost(posts) {
  if (!Array.isArray(posts)) return false;
  return posts.some((p) => p?.compliantJoin);
}

function joinCopy(userDisplayName) {
  return (
    `COMPLIANT notice for ${userDisplayName}: this profile is now active on the platform. ` +
    'Machine data from their device has been linked to their public identity.'
  );
}

function postCreatedAtMs(post) {
  const v = post?.createdAt ?? post?.created_at ?? 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

export function joinCreatedAtBeforeExisting(posts) {
  let min = Date.now();
  for (const p of Array.isArray(posts) ? posts : []) {
    const t = postCreatedAtMs(p);
    if (Number.isFinite(t) && t <= min) min = t - 1;
  }
  return min;
}

export function createCompliantJoinPost({
  profile,
  userDisplayName,
  dominantPersona,
  createdAt: createdAtOverride,
}) {
  const fromProfile = [profile?.firstname, profile?.lastname].filter(Boolean).join(' ').trim();
  const name = userDisplayName ?? (fromProfile || 'User');
  const persona = dominantPersona ?? profile?.dominantPersona ?? 'productivity';
  const createdAt = Number(createdAtOverride) || Date.now();

  return {
    id: `compliant-join-${createdAt}`,
    persona,
    createdAt,
    content: joinCopy(name),
    compliantJoin: {
      userDisplayName: name,
    },
  };
}
