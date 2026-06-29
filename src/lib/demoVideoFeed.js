/**
 * Demo-video pipeline — the client-only counterpart to demoRotateFeed.js.
 *
 * Where the real "demo rotate" queues hosted AI jobs for real DB profiles and
 * reveals them off the directory poll, this drives FAKE users entirely in the
 * browser: for each scheduled step it asks the local generator for one post
 * (LM Studio, ephemeral — see server-generate.js `/api/demo-video/generate-post`)
 * and then reveals it through the SAME spectator reveal controller, so the
 * descend/burst/materialize animation, pacing and ordering are identical.
 *
 * Nothing is persisted: the fake users + their posts live only in `allProfiles`
 * (React state) and vanish on refresh.
 */
import {
  POST_FEED_ENTER_ANIM_MS,
  sleep,
} from '@/lib/postFeedRevealQueue.js';
import { postIdentityKey, mergePostsPrepend } from '@/lib/mergePersonaPosts.js';

export const DEMO_VIDEO_REVEAL_GAP_MS = 2200;

async function generateFakePost(generateApiOrigin, step) {
  const res = await fetch(`${generateApiOrigin}/api/demo-video/generate-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      assetBasename: step.assetBasename,
      fakeUserName: step.user.displayName,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text.slice(0, 200) || `Demo-video generate failed (${res.status})`);
  }
  const json = await res.json();
  const post = json?.post;
  if (!post || !post.content) throw new Error('Demo-video generate returned no post');
  // Point the attachment at the app-served absolute URL (the public/videoDEMO
  // file), so the feed renders it directly instead of resolving against the API
  // origin. createdAt newest-first so reveals stack on top.
  post.attachedAsset = {
    ...(post.attachedAsset ?? {}),
    url: step.assetUrl,
    filename: step.assetBasename,
  };
  if (!post.createdAt) post.createdAt = new Date().toISOString();
  return post;
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
 * @param {string}   opts.generateApiOrigin
 * @param {object}   opts.spectateController
 * @param {function} opts.ensureFakeUser  - (user, posts) => void: make sure the fake
 *                                          user is present in allProfiles (idempotent)
 * @param {function} [opts.onGeneratingPersona]
 * @param {function} [opts.shouldContinue]
 */
export async function runDemoVideoPipeline({
  schedule,
  generateApiOrigin,
  spectateController,
  ensureFakeUser,
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
      const post = await generateFakePost(generateApiOrigin, step);
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
