function cleanPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shortUserSuffix(userId) {
  return String(userId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toLowerCase();
}

export function buildProfileSlug(firstname, lastname, userId) {
  const base = [cleanPart(firstname), cleanPart(lastname)].filter(Boolean).join('-') || 'demo-user';
  const suffix = shortUserSuffix(userId);
  return suffix ? `${base}-${suffix}` : base;
}

function displayNameFromPayload(payload) {
  const first = String(payload?.firstname ?? payload?.firstName ?? '').trim();
  const last = String(payload?.lastname ?? payload?.lastName ?? '').trim();
  return [first, last].filter(Boolean).join(' ') || 'Demo User';
}

export function mapSyncPayloadToProfileRow(payload, userId, slug) {
  const first = String(payload?.firstname ?? payload?.firstName ?? '').trim();
  const last = String(payload?.lastname ?? payload?.lastName ?? '').trim();
  return {
    user_id: userId,
    slug,
    firstname: first,
    lastname: last,
    display_name: displayNameFromPayload(payload),
    machine_name: String(payload?.machineName ?? payload?.machine_name ?? '').trim(),
    global_score: Number.isFinite(Number(payload?.globalScore ?? payload?.global_score))
      ? Number(payload?.globalScore ?? payload?.global_score)
      : null,
    persona_scores: payload?.personaScores ?? payload?.persona_scores ?? {},
    dominant_persona: payload?.dominantPersona ?? payload?.dominant_persona ?? null,
    profile_summary: String(payload?.profileSummary ?? payload?.userDescription ?? '').trim(),
    wallpaper_url: payload?.wallpaperUrl ?? payload?.wallpaper_url ?? null,
    raw_profile: payload && typeof payload === 'object' ? payload : {},
    collected_at: payload?.collectedAt ?? payload?.collected_at ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function mapProfileRowForApi(row, posts = []) {
  if (!row) return null;
  return {
    id: row.slug,
    profileUuid: row.id,
    userId: row.user_id,
    slug: row.slug,
    firstname: row.firstname,
    lastname: row.lastname,
    displayName: row.display_name,
    machineName: row.machine_name,
    globalScore: row.global_score,
    personaScores: row.persona_scores ?? {},
    dominantPersona: row.dominant_persona,
    profileSummary: row.profile_summary,
    userDescription: row.profile_summary,
    wallpaperUrl: row.wallpaper_url,
    collectedAt: row.collected_at,
    personaPosts: posts,
  };
}

export function mapPostRowForApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    persona: row.persona,
    content: row.content,
    sentiment: row.sentiment,
    attachedAsset: row.attached_asset ?? null,
    leaderboard: row.leaderboard ?? null,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function mapPostForInsert(post, profileId, userId, source = 'sync') {
  return {
    profile_id: profileId,
    user_id: userId,
    persona: String(post?.persona || 'productivite'),
    content: String(post?.content || ''),
    sentiment: post?.sentiment === 'positive' || post?.sentiment === 'negative' ? post.sentiment : null,
    attached_asset: post?.attachedAsset ?? post?.attached_asset ?? null,
    leaderboard: post?.leaderboard ?? null,
    source,
    created_at: post?.createdAt ?? post?.created_at ?? new Date().toISOString(),
  };
}
