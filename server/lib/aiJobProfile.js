import { slimProfilePayloadForStorage } from './publicProfileMapping.js';

export function profileSlugFromBody(body) {
  return String(
    body?.profileSlug ?? body?.profile?.slug ?? body?.profile?.id ?? '',
  ).trim();
}

/** Resolve DB profile row + worker payload for interactive AI jobs. */
export async function resolveAiJobProfileContext(profileStore, body) {
  const slug = profileSlugFromBody(body);
  const clientProfile = body?.profile && typeof body.profile === 'object' ? body.profile : {};

  if (!slug) {
    return {
      slug: '',
      profileId: null,
      userId: null,
      profileForWorker: clientProfile,
      dataJson: body?.dataJson ?? null,
    };
  }

  const row = await profileStore.getProfileRowBySlug(slug);
  if (!row) {
    return {
      slug,
      profileId: null,
      userId: null,
      profileForWorker: clientProfile,
      dataJson: body?.dataJson ?? null,
    };
  }

  const apiProfile = await profileStore.getProfileBySlug(slug);
  const profileForWorker = slimProfilePayloadForStorage({
    ...(apiProfile && typeof apiProfile === 'object' ? apiProfile : {}),
    ...clientProfile,
  });

  const raw = row.raw_profile && typeof row.raw_profile === 'object' ? row.raw_profile : {};
  const dataJson = body?.dataJson ?? raw?.dataJson ?? null;

  return {
    slug,
    profileId: row.id,
    userId: row.user_id,
    profileForWorker,
    dataJson,
  };
}
