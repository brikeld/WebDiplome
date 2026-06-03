import { slimProfilePayloadForStorage } from './publicProfileMapping.js';
import { resolveSubjectProfileContext } from './aiJobProfile.js';
import { isCompliantSystemPost } from './postsMerge.js';

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

  const latest = await jobStore.findLatestJobPayload(row.id, 'posts');
  const priorPayload = latest?.request_payload;
  let requestPayload;

  if (priorPayload && typeof priorPayload === 'object') {
    const { assetCandidates: _stale, ...priorWithoutAssets } = priorPayload;
    requestPayload = {
      ...priorWithoutAssets,
      jobType: 'posts',
      profile: slimProfilePayloadForStorage(apiProfile ?? {}),
      existingPosts: Array.isArray(apiProfile?.personaPosts) ? apiProfile.personaPosts : [],
    };
  } else {
    const ctx = await resolveSubjectProfileContext(
      profileStore,
      { profileSlug: slug },
      { jobStore },
    );
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
