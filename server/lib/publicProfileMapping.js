import { normalizeAttachedAssetForApi, resolveHostedPublicUrl } from './publicMediaUrls.js';

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

/** Drop huge/redundant fields before persisting raw_profile (wallpaper → wallpaper_url only). */
export function slimProfilePayloadForStorage(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const out = { ...payload };
  delete out.wallpaperBase64;
  delete out.wallpaper_base64;
  delete out.personaPosts;
  delete out.persona_posts;
  delete out.dataJson;
  delete out.data_json;
  return out;
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
    raw_profile: slimProfilePayloadForStorage(payload),
    collected_at: payload?.collectedAt ?? payload?.collected_at ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function mapPersonaBlurbsForApi(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const productivity = String(raw.productivity ?? raw.productivite ?? '').trim();
  const security = String(raw.security ?? raw.securite ?? '').trim();
  const social = String(raw.social ?? raw.popularite ?? raw.popularity ?? '').trim();
  if (!productivity && !security && !social) return null;
  return { productivity, security, social };
}

export function mapPersonaBlurbsForStorage(uiBlurbs) {
  if (!uiBlurbs || typeof uiBlurbs !== 'object') return {};
  return {
    productivite: String(uiBlurbs.productivity ?? uiBlurbs.productivite ?? '').trim(),
    securite: String(uiBlurbs.security ?? uiBlurbs.securite ?? '').trim(),
    popularite: String(uiBlurbs.social ?? uiBlurbs.popularite ?? uiBlurbs.popularity ?? '').trim(),
    productivity: String(uiBlurbs.productivity ?? uiBlurbs.productivite ?? '').trim(),
    security: String(uiBlurbs.security ?? uiBlurbs.securite ?? '').trim(),
    social: String(uiBlurbs.social ?? uiBlurbs.popularite ?? uiBlurbs.popularity ?? '').trim(),
  };
}

export function mapProfileRowForApi(row, posts = []) {
  if (!row) return null;
  const raw = row.raw_profile && typeof row.raw_profile === 'object' ? row.raw_profile : {};
  const wallpaperCandidate =
    row.wallpaper_url ??
    raw.wallpaperUrl ??
    raw.wallpaper_url ??
    raw.avatarUrl ??
    raw.avatar_url ??
    null;
  const resolvedWallpaper = resolveHostedPublicUrl(wallpaperCandidate) ?? null;
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
    wallpaperUrl: resolvedWallpaper,
    avatarUrl: resolvedWallpaper,
    collectedAt: row.collected_at,
    personaBlurbs: mapPersonaBlurbsForApi(row.persona_blurbs),
    personaPosts: posts,
  };
}

export function mapProfileRowForSummary(row, stats = {}) {
  const profile = mapProfileRowForApi(row, []);
  if (!profile) return null;
  return {
    ...profile,
    personaPosts: [],
    postCount: Number(stats.postCount) || 0,
    latestPostAt: stats.latestPostAt ?? null,
  };
}

const POST_METADATA_KEYS = [
  'inferenceChain',
  'ingredients',
  'highlights',
  'thinking',
  'chartType',
  'textSliceType',
  'textSliceAngle',
  'textSliceContext',
  'wifiPostAngle',
  'compliantPersonaChange',
  'compliantLowScore',
  'compliantJoin',
];

export function extractPostMetadata(post) {
  if (!post || typeof post !== 'object') return {};
  const meta = post.metadata && typeof post.metadata === 'object' ? { ...post.metadata } : {};
  for (const key of POST_METADATA_KEYS) {
    if (post[key] !== undefined && post[key] !== null) meta[key] = post[key];
  }
  return meta;
}

export function mapPostRowForApi(row) {
  if (!row) return null;
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    id: row.id,
    persona: row.persona,
    content: row.content,
    sentiment: row.sentiment,
    attachedAsset: normalizeAttachedAssetForApi(row.attached_asset ?? null),
    leaderboard: row.leaderboard ?? null,
    source: row.source,
    createdAt: row.created_at,
    ...metadata,
  };
}

function normalizePostCreatedAt(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  const text = String(value ?? '').trim();
  if (/^\d+$/.test(text)) {
    const date = new Date(Number(text));
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  return text || new Date().toISOString();
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
    metadata: extractPostMetadata(post),
    source,
    created_at: normalizePostCreatedAt(post?.createdAt ?? post?.created_at),
  };
}
