/**
 * Demo-video pipeline — drives FAKE users on the feed for a demo recording.
 *
 * It runs the SAME hosted path as the demo button: each step queues an ephemeral
 * `demo-video` generation job (POST /api/debug/demo-video/post) that the
 * operator's worker PC picks up. Hosted jobs pass a public Vercel asset URL, so
 * the worker can fetch the file over HTTP even though the original files live on
 * a different computer. It captions the asset via LM Studio, uploads the image
 * to storage, and returns the post on the job row. The client polls the job,
 * then reveals the post through the spectator reveal controller, so the descend,
 * burst, materialize animation, pacing and ordering are identical.
 *
 * Nothing is persisted as a profile: the fake users + posts live only in
 * `allProfiles` (React state) and the job rows; they vanish on refresh. This
 * works on the deployed site (Vercel→Railway→worker) with no local servers.
 */
import { resolveApiOrigin, resolveDemoVideoGenerateOrigin } from '@/lib/apiOrigin.js';
import {
  POST_FEED_ENTER_ANIM_MS,
  sleep,
} from '@/lib/postFeedRevealQueue.js';
import { postIdentityKey, mergePostsPrepend } from '@/lib/mergePersonaPosts.js';
import { fetchWithHostedAuth } from '@/lib/hostedAccount.js';

const API_ORIGIN = resolveApiOrigin();
const LOCAL_GENERATE_ORIGIN = resolveDemoVideoGenerateOrigin();
export const DEMO_VIDEO_REVEAL_GAP_MS = 2200;
const JOB_POLL_MS = 1500;
const JOB_TIMEOUT_MS = 180000;

export function isLocalDemoVideoApiOrigin(origin) {
  try {
    const host = new URL(String(origin || '')).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function localContentAssetUrl(assetBasename) {
  return `${LOCAL_GENERATE_ORIGIN}/videoDEMO/contentFakePeople/${encodeURIComponent(assetBasename)}`;
}

export function demoVideoPublicAssetUrl(assetBasename, origin = '') {
  const clean = String(assetBasename || '').trim();
  if (!clean) return '';
  const base = String(origin || '').replace(/\/$/, '');
  const pathname = `/videoDEMO/contentFakePeople/${encodeURIComponent(clean)}`;
  return base ? `${base}${pathname}` : pathname;
}

export function buildHostedDemoVideoJobPayload(step, publicOrigin = '') {
  const assetBasename = String(step?.assetBasename || '').trim();
  return {
    assetBasename,
    fakeUserName: String(step?.user?.displayName || '').trim() || 'A user',
    assetUrl: demoVideoPublicAssetUrl(assetBasename, publicOrigin),
  };
}

async function generateLocalFakePost(step) {
  const res = await fetch(`${LOCAL_GENERATE_ORIGIN}/api/demo-video/generate-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      assetBasename: step.assetBasename,
      fakeUserName: step.user.displayName,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Demo-video generate failed (${res.status})`);
  }
  const post = json?.post;
  if (!post?.content) throw new Error('Demo-video generate returned no post');
  post.attachedAsset = {
    ...(post.attachedAsset ?? {}),
    url: localContentAssetUrl(step.assetBasename),
    filename: step.assetBasename,
  };
  if (!post.createdAt) post.createdAt = new Date().toISOString();
  return post;
}

async function generateHostedFakePost(step, shouldContinue) {
  const publicOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const queueRes = await fetchWithHostedAuth(`${API_ORIGIN}/api/debug/demo-video/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(buildHostedDemoVideoJobPayload(step, publicOrigin)),
  });
  const queued = await queueRes.json().catch(() => ({}));
  if (!queueRes.ok || !queued?.jobId) {
    throw new Error(queued?.error || `Demo-video queue failed (${queueRes.status})`);
  }

  const start = Date.now();
  while (shouldContinue() && Date.now() - start < JOB_TIMEOUT_MS) {
    await sleep(JOB_POLL_MS);
    const res = await fetch(
      `${API_ORIGIN}/api/generation-jobs/${encodeURIComponent(queued.jobId)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) continue;
    const { job } = await res.json();
    if (job?.status === 'failed') throw new Error(job.error || 'Demo-video generation failed');
    if (job?.status !== 'complete') continue;
    const post = job.result?.post ?? (Array.isArray(job.result) ? job.result[0] : null);
    if (!post?.content) throw new Error('Demo-video job returned no post');
    if (!post.createdAt) post.createdAt = new Date().toISOString();
    return post;
  }
  return null;
}

async function generateFakePost(step, shouldContinue) {
  if (isLocalDemoVideoApiOrigin(API_ORIGIN)) {
    return generateLocalFakePost(step);
  }
  return generateHostedFakePost(step, shouldContinue);
}

export function mergeDemoVideoPostIntoProfiles(profiles, userSlug, post) {
  const list = Array.isArray(profiles) ? profiles : [];
  const slug = String(userSlug || '').trim();
  if (!slug || !post?.content) return list;

  let matched = false;
  const next = list.map((profile) => {
    const key = String(profile?.slug ?? profile?.id ?? '');
    if (key !== slug) return profile;
    matched = true;
    return {
      ...profile,
      personaPosts: mergePostsPrepend([post], profile.personaPosts ?? []),
    };
  });
  return matched ? next : list;
}

/**
 * Reveal one already-generated post for a fake user through the spectator
 * controller (same machinery as demo rotate). The fake user must already exist
 * in `allProfiles` so the controller's `onPostsChange` can patch its posts.
 */
async function revealFakePost({
  user,
  accumulatedPosts,
  spectateController,
  shouldContinue,
}) {
  const slug = user.slug;
  const newest = accumulatedPosts[0];
  const postKey = postIdentityKey(newest);
  try {
    spectateController?.setIngestAllowSlugs?.([slug]);
    if (postKey) spectateController?.setExpectedRevealKey?.(slug, postKey);
    // Feed the synthetic profile snapshot in; the controller establishes the
    // baseline (everything but the expected key) then animates the new post.
    spectateController?.ingestProfiles?.([{ ...user, personaPosts: accumulatedPosts }]);

    if (spectateController?.waitForSlugIdle) {
      await spectateController.waitForSlugIdle(slug, { waitForEnterAnimation: true });
    } else {
      await sleep(POST_FEED_ENTER_ANIM_MS);
    }
  } finally {
    spectateController?.setExpectedRevealKey?.(slug, null);
    spectateController?.setIngestAllowSlugs?.(null);
  }
  return shouldContinue();
}

/**
 * Round-robin demo-video feed. Generation is pipelined one step ahead of the
 * reveal (like demo rotate) so LM Studio keeps working while the current post
 * animates in.
 *
 * @param {object}   opts
 * @param {Array}    opts.schedule        - from buildDemoVideoSchedule()
 * @param {object}   opts.spectateController
 * @param {function} opts.ensureFakeUser  - (user, posts) => void: make sure the fake
 *                                          user is present in allProfiles (idempotent)
 * @param {function} [opts.onPostGenerated]
 * @param {function} [opts.onGeneratingPersona]
 * @param {function} [opts.shouldContinue]
 */
export async function runDemoVideoPipeline({
  schedule,
  spectateController,
  ensureFakeUser,
  onPostGenerated,
  onGeneratingPersona,
  shouldContinue = () => true,
  revealGapMs = DEMO_VIDEO_REVEAL_GAP_MS,
}) {
  const steps = Array.isArray(schedule) ? schedule : [];
  if (steps.length === 0) throw new Error('No demo-video schedule available');

  // Accumulated posts per fake user (newest first), so a user revisited later in
  // the round-robin keeps their earlier posts beneath the new one.
  const postsByUser = new Map();

  const generateStep = async (index) => {
    if (!shouldContinue()) return null;
    const step = steps[index % steps.length];
    try {
      const post = await generateFakePost(step, shouldContinue);
      return { step, post };
    } catch (err) {
      console.warn(`[demo-video] generate ${step.assetBasename}:`, err?.message || err);
      return { step, post: null };
    }
  };

  try {
    let pending = generateStep(0);
    let index = 0;

    while (shouldContinue()) {
      const result = await pending;
      index += 1;
      // Kick off the next generation while the current post reveals.
      pending = generateStep(index);

      if (!result || !result.post) {
        await sleep(300);
        continue;
      }

      const { step, post } = result;
      const slug = step.user.slug;
      const prevAccumulated = postsByUser.get(slug) ?? [];
      // Ensure the user exists in allProfiles WITH their already-revealed posts
      // only — the new post must arrive through the reveal animation below, not
      // pre-injected, or it would pop in without the descend/burst effect.
      ensureFakeUser?.(step.user, prevAccumulated);
      const accumulated = mergePostsPrepend([post], prevAccumulated);
      postsByUser.set(slug, accumulated);
      onPostGenerated?.(step.user, post, accumulated);

      onGeneratingPersona?.(post.persona ?? null);
      try {
        await revealFakePost({
          user: step.user,
          accumulatedPosts: accumulated,
          spectateController,
          shouldContinue,
        });
      } catch (err) {
        console.warn(`[demo-video] reveal ${slug}:`, err?.message || err);
      }
      onGeneratingPersona?.(null);

      await sleep(revealGapMs);
    }

    await pending.catch(() => null);
  } finally {
    for (const step of steps) {
      spectateController?.setExpectedRevealKey?.(step.user.slug, null);
    }
    spectateController?.setIngestAllowSlugs?.(null);
    onGeneratingPersona?.(null);
  }
}
