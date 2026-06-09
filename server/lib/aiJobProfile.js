import { slimProfilePayloadForStorage } from './publicProfileMapping.js';
import { harvestPayloadHasContent } from './generationQueue.js';
import { resolveProfileHarvestDataJson } from './resolveProfileHarvestData.js';

export function profileSlugFromBody(body) {
  return String(
    body?.profileSlug ?? body?.profile?.slug ?? body?.profile?.id ?? '',
  ).trim();
}

export function viewerProfileSlugFromBody(body) {
  return String(
    body?.viewerProfileSlug
    ?? body?.viewerProfile?.slug
    ?? body?.viewerProfile?.id
    ?? body?.profileSlug
    ?? body?.profile?.slug
    ?? body?.profile?.id
    ?? '',
  ).trim();
}

/** Profile page subject (blurbs, public copy) — not the logged-in viewer. */
export async function resolveSubjectProfileContext(profileStore, body, { jobStore } = {}) {
  const slug = profileSlugFromBody(body);

  if (!slug) {
    return { slug: '', profileId: null, userId: null, profileForWorker: {}, dataJson: null };
  }

  const row = await profileStore.getProfileRowBySlug(slug);
  if (!row) {
    return { slug, profileId: null, userId: null, profileForWorker: {}, dataJson: null };
  }

  const apiProfile = await profileStore.getProfileBySlug(slug);
  const profileForWorker = slimProfilePayloadForStorage(apiProfile ?? {});

  const raw = row.raw_profile && typeof row.raw_profile === 'object' ? row.raw_profile : {};
  const dataJson = harvestPayloadHasContent(body?.dataJson)
    ? body.dataJson
    : await resolveProfileHarvestDataJson(raw, row.id, jobStore);

  return {
    slug,
    profileId: row.id,
    userId: row.user_id,
    profileForWorker,
    dataJson,
    personaBlurbs: await profileStore.getPersonaBlurbs(row.id),
  };
}

/** Logged-in viewer generating comment suggestions on someone else's post. */
export async function resolveCommenterProfileContext(profileStore, body, { jobStore } = {}) {
  const slug = viewerProfileSlugFromBody(body);
  const clientProfile = body?.viewerProfile && typeof body.viewerProfile === 'object'
    ? body.viewerProfile
    : (body?.profile && typeof body.profile === 'object' ? body.profile : {});

  if (!slug) {
    return {
      slug: '',
      profileId: null,
      userId: null,
      profileForWorker: clientProfile,
      dataJson: null,
    };
  }

  const row = await profileStore.getProfileRowBySlug(slug);
  if (!row) {
    return {
      slug,
      profileId: null,
      userId: null,
      profileForWorker: clientProfile,
      dataJson: null,
    };
  }

  const apiProfile = await profileStore.getProfileBySlug(slug);
  const profileForWorker = slimProfilePayloadForStorage({
    ...(apiProfile && typeof apiProfile === 'object' ? apiProfile : {}),
    ...clientProfile,
  });

  const raw = row.raw_profile && typeof row.raw_profile === 'object' ? row.raw_profile : {};
  const dataJson = harvestPayloadHasContent(body?.dataJson)
    ? body.dataJson
    : await resolveProfileHarvestDataJson(raw, row.id, jobStore);

  return {
    slug,
    profileId: row.id,
    userId: row.user_id,
    profileForWorker,
    dataJson,
  };
}

/** @deprecated use resolveCommenterProfileContext or resolveSubjectProfileContext */
export async function resolveAiJobProfileContext(profileStore, body, options = {}) {
  return resolveCommenterProfileContext(profileStore, body, options);
}
