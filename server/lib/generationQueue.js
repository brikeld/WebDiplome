import { slimProfilePayloadForStorage } from './publicProfileMapping.js';
import { resolveSubjectProfileContext } from './aiJobProfile.js';
import { isCompliantSystemPost } from './postsMerge.js';
import { isDemoRotateTargetProfile } from './demoRotate.js';

/** Persona posts from LM (excludes COMPLIANT system notices). */
export const EXPECTED_AI_POST_COUNT = 3;

export function countAiGeneratedPosts(posts) {
  if (!Array.isArray(posts)) return 0;
  return posts.filter(
    (p) => p && String(p.content || '').trim() && !isCompliantSystemPost(p),
  ).length;
}

export function profileNeedsInitialGeneration(profile) {
  const posts = profile?.personaPosts ?? profile?.persona_posts ?? [];
  return countAiGeneratedPosts(posts) < EXPECTED_AI_POST_COUNT;
}

/** True when harvest JSON is present enough for the worker to run LM prompts. */
export function harvestPayloadHasContent(dataJson) {
  if (!dataJson || typeof dataJson !== 'object') return false;
  if (Array.isArray(dataJson)) return dataJson.length > 0;
  return Object.keys(dataJson).length > 0;
}

export function hasAssetCandidates(payload) {
  return Array.isArray(payload?.assetCandidates) && payload.assetCandidates.length > 0;
}

export function mergeGenerationRequestPayload(existing = {}, incoming = {}) {
  const jobType = incoming.jobType || existing.jobType || 'posts';
  const merged = {
    ...existing,
    ...incoming,
    jobType,
    user: { ...(existing.user || {}), ...(incoming.user || {}) },
    profile: incoming.profile || existing.profile,
    dataJson: harvestPayloadHasContent(incoming.dataJson)
      ? incoming.dataJson
      : (existing.dataJson ?? incoming.dataJson ?? {}),
    existingPosts: Array.isArray(incoming.existingPosts)
      ? incoming.existingPosts
      : (existing.existingPosts ?? []),
  };
  if (hasAssetCandidates(incoming)) {
    merged.assetCandidates = incoming.assetCandidates;
  } else if (hasAssetCandidates(existing)) {
    merged.assetCandidates = existing.assetCandidates;
  }
  if (incoming.assetPersona) merged.assetPersona = incoming.assetPersona;
  return merged;
}

/** True when a queued job payload should be patched before the worker claims it. */
export function shouldPatchQueuedGenerationPayload(existing = {}, incoming = {}) {
  const existingData = existing.dataJson ?? existing.data_json;
  const incomingData = incoming.dataJson ?? incoming.data_json;
  const needsHarvest =
    !harvestPayloadHasContent(existingData) && harvestPayloadHasContent(incomingData);
  const needsAssets = hasAssetCandidates(incoming) && !hasAssetCandidates(existing);
  return needsHarvest || needsAssets;
}

async function findActivePostsFamilyJob(jobStore, profileId) {
  if (!jobStore || !profileId) return null;
  return (
    await jobStore.findActiveJob({ profileId, jobType: 'posts' })
    || await jobStore.findActiveJob({ profileId, jobType: 'posts-single' })
  );
}

function userPayloadFromProfileRow(row, apiProfile) {
  const raw = row?.raw_profile && typeof row.raw_profile === 'object' ? row.raw_profile : {};
  const api = apiProfile && typeof apiProfile === 'object' ? apiProfile : {};
  return {
    first_name: raw.firstname ?? raw.first_name ?? api.firstname ?? '',
    last_name: raw.lastname ?? raw.last_name ?? api.lastname ?? '',
    age: raw.age ?? api.age ?? 0,
  };
}

/**
 * Queue a posts job when the profile still lacks AI-generated persona posts.
 * Reuses the latest job payload (incl. harvest dataJson) when available.
 */
export async function queueInitialPostsJobIfNeeded({
  profileStore,
  jobStore,
  profileSlug,
  userId = null,
}) {
  const slug = String(profileSlug || '').trim();
  if (!slug || !profileStore || !jobStore) {
    return { queued: false, reason: 'missing_context' };
  }

  const row = await profileStore.getProfileRowBySlug(slug);
  if (!row) return { queued: false, reason: 'profile_not_found' };
  if (userId && row.user_id !== userId) {
    return { queued: false, reason: 'forbidden' };
  }

  const apiProfile = await profileStore.getProfileBySlug(slug);
  if (!profileNeedsInitialGeneration(apiProfile)) {
    return { queued: false, reason: 'already_complete', alreadyComplete: true };
  }

  const active = await jobStore.findActiveJob({ profileId: row.id, jobType: 'posts' });
  if (active) {
    return {
      queued: false,
      alreadyQueued: true,
      jobId: active.id,
      status: active.status,
    };
  }

  const ctx = await resolveSubjectProfileContext(
    profileStore,
    { profileSlug: slug },
    { jobStore },
  );

  const latest = await jobStore.findLatestJobPayload(row.id, 'posts');
  const priorPayload = latest?.request_payload;
  let requestPayload;

  if (priorPayload && typeof priorPayload === 'object') {
    const priorData = priorPayload.dataJson ?? priorPayload.data_json;
    requestPayload = {
      ...priorPayload,
      jobType: 'posts',
      profile: slimProfilePayloadForStorage(apiProfile ?? {}),
      existingPosts: Array.isArray(apiProfile?.personaPosts) ? apiProfile.personaPosts : [],
      dataJson: harvestPayloadHasContent(ctx.dataJson)
        ? ctx.dataJson
        : (harvestPayloadHasContent(priorData) ? priorData : (ctx.dataJson ?? {})),
    };
  } else {
    requestPayload = {
      jobType: 'posts',
      user: userPayloadFromProfileRow(row, apiProfile),
      profile: ctx.profileForWorker,
      dataJson: ctx.dataJson ?? {},
      existingPosts: Array.isArray(apiProfile?.personaPosts) ? apiProfile.personaPosts : [],
    };
  }

  const job = await jobStore.createJob({
    userId: row.user_id,
    profileId: row.id,
    requestPayload,
  });

  return { queued: true, jobId: job.id, status: job.status };
}

async function queuePostsJobFromHarvestSync({
  profileStore,
  jobStore,
  profileSlug,
  userId = null,
  syncDataJson = null,
  assetCandidates = null,
  assetPersona = null,
  mode = 'initial',
}) {
  const jobType = mode === 'single' ? 'posts-single' : 'posts';
  const slug = String(profileSlug || '').trim();
  if (!slug || !profileStore || !jobStore) {
    return { queued: false, reason: 'missing_context' };
  }

  const row = await profileStore.getProfileRowBySlug(slug);
  if (!row) return { queued: false, reason: 'profile_not_found' };
  if (userId && row.user_id !== userId) {
    return { queued: false, reason: 'forbidden' };
  }

  const apiProfile = await profileStore.getProfileBySlug(slug);
  if (mode === 'initial' && !profileNeedsInitialGeneration(apiProfile)) {
    return { queued: false, reason: 'already_complete', alreadyComplete: true };
  }

  if (mode === 'single' && !isDemoRotateTargetProfile(apiProfile ?? row)) {
    return { queued: false, reason: 'excluded_profile' };
  }

  const incomingData = syncDataJson ?? null;
  if (!harvestPayloadHasContent(incomingData)) {
    return { queued: false, reason: 'no_harvest_data' };
  }

  const active = await findActivePostsFamilyJob(jobStore, row.id);
  if (active) {
    const existingPayload =
      active.request_payload && typeof active.request_payload === 'object'
        ? active.request_payload
        : {};
    const patchPayload = {
      jobType,
      profile: slimProfilePayloadForStorage(apiProfile ?? {}),
      dataJson: incomingData,
      existingPosts: Array.isArray(apiProfile?.personaPosts) ? apiProfile.personaPosts : [],
      user: userPayloadFromProfileRow(row, apiProfile),
      ...(hasAssetCandidates({ assetCandidates }) ? { assetCandidates, assetPersona } : {}),
    };
    if (active.status === 'queued' && shouldPatchQueuedGenerationPayload(existingPayload, patchPayload)) {
      const merged = mergeGenerationRequestPayload(existingPayload, patchPayload);
      await jobStore.updateQueuedJobPayload(active.id, merged);
      return {
        queued: false,
        payloadUpdated: true,
        jobId: active.id,
        status: active.status,
      };
    }
    return {
      queued: false,
      alreadyQueued: true,
      jobId: active.id,
      status: active.status,
    };
  }

  const latest = await jobStore.findLatestJobPayload(row.id, 'posts');
  const priorPayload = latest?.request_payload;
  const requestPayload = priorPayload && typeof priorPayload === 'object'
    ? mergeGenerationRequestPayload(priorPayload, {
        jobType,
        profile: slimProfilePayloadForStorage(apiProfile ?? {}),
        dataJson: incomingData,
        existingPosts: Array.isArray(apiProfile?.personaPosts) ? apiProfile.personaPosts : [],
        user: userPayloadFromProfileRow(row, apiProfile),
        ...(hasAssetCandidates({ assetCandidates }) ? { assetCandidates, assetPersona } : {}),
      })
    : {
        jobType,
        user: userPayloadFromProfileRow(row, apiProfile),
        profile: slimProfilePayloadForStorage(apiProfile ?? {}),
        dataJson: incomingData,
        existingPosts: Array.isArray(apiProfile?.personaPosts) ? apiProfile.personaPosts : [],
        ...(hasAssetCandidates({ assetCandidates }) ? { assetCandidates, assetPersona } : {}),
      };

  const job = await jobStore.createJob({
    userId: row.user_id,
    profileId: row.id,
    requestPayload,
  });

  return { queued: true, jobId: job.id, status: job.status };
}

/**
 * After Electron harvest sync: start worker generation without opening the website.
 * Updates a stale queued job when sync carries real harvest dataJson.
 */
export async function queuePostsJobAfterHarvestSync(args) {
  return queuePostsJobFromHarvestSync({ ...args, mode: 'initial' });
}

/** Queue a fresh posts job after a dashboard harvest when the profile already has AI posts. */
export async function queueUpdatePostsJobAfterHarvestSync(args) {
  return queuePostsJobFromHarvestSync({ ...args, mode: 'update' });
}

/** Queue one LM slot (one post) for demo round-robin — uses stored harvest only. */
export async function queueSinglePostJob(args) {
  return queuePostsJobFromHarvestSync({ ...args, mode: 'single' });
}
