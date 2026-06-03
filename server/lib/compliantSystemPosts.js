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

export function createCompliantJoinPost({ profile, userDisplayName, dominantPersona }) {
  const fromProfile = [profile?.firstname, profile?.lastname].filter(Boolean).join(' ').trim();
  const name = userDisplayName ?? (fromProfile || 'User');
  const persona = dominantPersona ?? profile?.dominantPersona ?? 'productivity';
  const createdAt = Date.now();

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
