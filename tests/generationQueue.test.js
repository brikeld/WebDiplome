import { describe, expect, it } from 'vitest';
import {
  harvestPayloadHasContent,
  mergeGenerationRequestPayload,
  countAiGeneratedPosts,
  queuePostsJobAfterHarvestSync,
  queueUpdatePostsJobAfterHarvestSync,
  queueSinglePostJob,
  profileNeedsInitialGeneration,
  hasAssetCandidates,
  shouldPatchQueuedGenerationPayload,
} from '../server/lib/generationQueue.js';

describe('generationQueue helpers', () => {
  it('detects empty vs real harvest payloads', () => {
    expect(harvestPayloadHasContent(null)).toBe(false);
    expect(harvestPayloadHasContent({})).toBe(false);
    expect(harvestPayloadHasContent({ user_identity: { name: 'A' } })).toBe(true);
    expect(harvestPayloadHasContent({ hostname: 'mac', model: 'MacBook' })).toBe(true);
  });

  it('merges incoming dataJson over empty queued payload', () => {
    const merged = mergeGenerationRequestPayload(
      { jobType: 'posts', dataJson: {}, user: { first_name: 'Old' } },
      { dataJson: { hostname: 'demo' }, user: { first_name: 'New' } },
    );
    expect(merged.dataJson).toEqual({ hostname: 'demo' });
    expect(merged.user.first_name).toBe('New');
  });

  it('keeps assetCandidates from incoming payload', () => {
    const candidates = [{ filename: 'a'.repeat(64) + '.jpg', url: '/uploads/x.jpg' }];
    const merged = mergeGenerationRequestPayload(
      { jobType: 'posts', dataJson: { hostname: 'demo' } },
      { assetCandidates: candidates, assetPersona: 'popularite' },
    );
    expect(merged.assetCandidates).toEqual(candidates);
    expect(merged.assetPersona).toBe('popularite');
  });

  it('detects when queued payload needs asset candidates', () => {
    const candidates = [{ filename: 'b'.repeat(64) + '.png', url: 'https://x/y.png' }];
    expect(hasAssetCandidates({ assetCandidates: candidates })).toBe(true);
    expect(shouldPatchQueuedGenerationPayload(
      { dataJson: { hostname: 'demo' } },
      { assetCandidates: candidates },
    )).toBe(true);
  });

  it('counts only non-system posts', () => {
    const n = countAiGeneratedPosts([
      { content: 'hello', persona: 'productivite' },
      { content: 'join', compliantJoin: true },
    ]);
    expect(n).toBe(1);
  });

  it('skips harvest sync queue when dataJson is empty', async () => {
    const outcome = await queuePostsJobAfterHarvestSync({
      profileStore: { getProfileRowBySlug: async () => null },
      jobStore: {},
      profileSlug: 'demo',
      syncDataJson: {},
    });
    expect(outcome.reason).toBe('profile_not_found');
  });

  it('queues update jobs even when the profile already has AI posts', async () => {
    const profileRow = { id: 'p1', user_id: 'u1', firstname: 'A', lastname: 'B' };
    const apiProfile = {
      personaPosts: [
        { content: 'one', persona: 'productivite' },
        { content: 'two', persona: 'securite' },
        { content: 'three', persona: 'popularite' },
      ],
    };
    let createdPayload = null;
    const outcome = await queueUpdatePostsJobAfterHarvestSync({
      profileStore: {
        getProfileRowBySlug: async () => profileRow,
        getProfileBySlug: async () => apiProfile,
      },
      jobStore: {
        findActiveJob: async () => null,
        findLatestJobPayload: async () => ({ request_payload: { jobType: 'posts', dataJson: { old: true } } }),
        createJob: async ({ requestPayload }) => {
          createdPayload = requestPayload;
          return { id: 'job-update-1', status: 'queued' };
        },
      },
      profileSlug: 'a-b',
      syncDataJson: { hostname: 'fresh-harvest' },
    });
    expect(outcome.queued).toBe(true);
    expect(outcome.jobId).toBe('job-update-1');
    expect(createdPayload.dataJson).toEqual({ hostname: 'fresh-harvest' });
    expect(profileNeedsInitialGeneration(apiProfile)).toBe(false);
  });

  it('queues single-post jobs with posts-single jobType', async () => {
    const profileRow = { id: 'p2', user_id: 'u2', firstname: 'Alex', lastname: 'Johnson' };
    const apiProfile = {
      displayName: 'Alex Johnson',
      personaPosts: [{ content: 'one', persona: 'productivite' }],
    };
    let createdPayload = null;
    const outcome = await queueSinglePostJob({
      profileStore: {
        getProfileRowBySlug: async () => profileRow,
        getProfileBySlug: async () => apiProfile,
      },
      jobStore: {
        findActiveJob: async () => null,
        findLatestJobPayload: async () => null,
        createJob: async ({ requestPayload }) => {
          createdPayload = requestPayload;
          return { id: 'job-single-1', status: 'queued' };
        },
      },
      profileSlug: 'alex-johnson',
      syncDataJson: { hostname: 'stored-harvest' },
    });
    expect(outcome.queued).toBe(true);
    expect(createdPayload.jobType).toBe('posts-single');
  });

  it('waits instead of piggybacking on an active full posts batch for demo single', async () => {
    const profileRow = { id: 'p4', user_id: 'u4', firstname: 'Alex', lastname: 'Johnson' };
    const apiProfile = {
      displayName: 'Alex Johnson',
      personaPosts: [{ content: 'one', persona: 'productivite' }],
    };
    const outcome = await queueSinglePostJob({
      profileStore: {
        getProfileRowBySlug: async () => profileRow,
        getProfileBySlug: async () => apiProfile,
      },
      jobStore: {
        findAnyActiveJobByTypes: async () => null,
        findActiveJob: async ({ jobType }) => (
          jobType === 'posts' ? { id: 'job-full-batch', status: 'claimed' } : null
        ),
      },
      profileSlug: 'alex-johnson',
      syncDataJson: { hostname: 'stored-harvest' },
    });
    expect(outcome.queued).toBe(false);
    expect(outcome.reason).toBe('generation_in_progress');
    expect(outcome.jobId).toBeUndefined();
    expect(outcome.alreadyQueued).toBeUndefined();
  });

  it('queues a posts-single job while another profile generation is active', async () => {
    const profileRow = { id: 'p6', user_id: 'u6', firstname: 'Alex', lastname: 'Johnson' };
    const apiProfile = {
      displayName: 'Alex Johnson',
      personaPosts: [{ content: 'one', persona: 'productivite' }],
    };
    let createdPayload = null;
    const outcome = await queueSinglePostJob({
      profileStore: {
        getProfileRowBySlug: async () => profileRow,
        getProfileBySlug: async () => apiProfile,
      },
      jobStore: {
        findActiveJob: async () => null,
        findLatestJobPayload: async () => null,
        createJob: async ({ requestPayload }) => {
          createdPayload = requestPayload;
          return { id: 'job-single-queued', status: 'queued' };
        },
      },
      profileSlug: 'alex-johnson',
      syncDataJson: { hostname: 'stored-harvest' },
    });
    expect(outcome.queued).toBe(true);
    expect(outcome.jobId).toBe('job-single-queued');
    expect(createdPayload.jobType).toBe('posts-single');
  });

  it('reuses an active posts-single job for demo rotate', async () => {
    const profileRow = { id: 'p5', user_id: 'u5', firstname: 'Alex', lastname: 'Johnson' };
    const apiProfile = {
      displayName: 'Alex Johnson',
      personaPosts: [{ content: 'one', persona: 'productivite' }],
    };
    const outcome = await queueSinglePostJob({
      profileStore: {
        getProfileRowBySlug: async () => profileRow,
        getProfileBySlug: async () => apiProfile,
      },
      jobStore: {
        findAnyActiveJobByTypes: async () => null,
        findActiveJob: async ({ jobType }) => (
          jobType === 'posts-single'
            ? { id: 'job-single-active', status: 'claimed', request_payload: { jobType: 'posts-single' } }
            : null
        ),
      },
      profileSlug: 'alex-johnson',
      syncDataJson: { hostname: 'stored-harvest' },
    });
    expect(outcome.alreadyQueued).toBe(true);
    expect(outcome.jobId).toBe('job-single-active');
  });

  it('rejects single-post jobs for excluded operator profile', async () => {
    const outcome = await queueSinglePostJob({
      profileStore: {
        getProfileRowBySlug: async () => ({ id: 'p3', user_id: 'u3' }),
        getProfileBySlug: async () => ({
          firstname: 'Brikeld',
          lastname: 'Hoxha',
          personaPosts: [],
        }),
      },
      jobStore: {
        findActiveJob: async () => null,
      },
      profileSlug: 'brikeld-hoxha',
      syncDataJson: { hostname: 'demo' },
    });
    expect(outcome.reason).toBe('excluded_profile');
  });
});
