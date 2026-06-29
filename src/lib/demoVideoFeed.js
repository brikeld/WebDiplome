/**
 * Demo-video pipeline — drives FAKE users on the feed for a demo recording.
 *
 * It does not generate anything. Each step reveals a prewritten post from
 * buildDemoVideoSchedule(), using the same spectator controller as demo rotate
 * so the descend, burst, materialize animation, pacing and ordering are
 * identical without LM Studio, Railway jobs, or an AI worker.
 *
 * Nothing is persisted as a profile: the fake users + posts live only in
 * `allProfiles` (React state) and vanish on refresh.
 */
import {
  POST_FEED_ENTER_ANIM_MS,
  sleep,
} from '@/lib/postFeedRevealQueue.js';
import { postIdentityKey, mergePostsPrepend } from '@/lib/mergePersonaPosts.js';

export const DEMO_VIDEO_REVEAL_GAP_MS = 2200;
const STATIC_POST_EPOCH_MS = Date.UTC(2026, 5, 29, 12, 0, 0);
const DEMO_VIDEO_CONTENT_PATH = '/videoDEMO/contentFakePeople';

const MIME_BY_EXT = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function extname(filename) {
  const match = String(filename || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? '';
}

function assetUrlFor(assetBasename) {
  return `${DEMO_VIDEO_CONTENT_PATH}/${encodeURIComponent(assetBasename)}`;
}

function personaLabel(persona) {
  return {
    productivite: 'Productivity',
    securite: 'Security',
    popularite: 'Popularity',
  }[persona] || 'Popularity';
}

function assetKindFor(assetBasename) {
  return extname(assetBasename) === '.pdf' ? 'document' : 'image';
}

export function materializeDemoVideoPost(step, index = 0) {
  const blueprint = step?.post ?? {};
  const assetBasename = String(step?.assetBasename || blueprint.assetBasename || '').trim();
  const persona = String(blueprint.persona || 'popularite');
  const content = String(blueprint.content || '').trim();
  if (!assetBasename || !content) return null;

  const kind = assetKindFor(assetBasename);
  const label = personaLabel(persona);
  const createdAt = new Date(STATIC_POST_EPOCH_MS + Math.max(0, Number(index) || 0) * 60_000).toISOString();
  const url = assetUrlFor(assetBasename);

  return {
    id: `demo-video-static-${index}-${assetBasename}`,
    persona,
    content,
    sentiment: persona === 'securite' ? 'negative' : 'positive',
    createdAt,
    inferenceChain: [
      {
        step: 'data',
        value: `Static demo asset: ${assetBasename}`,
        source: kind === 'document' ? 'Demo PDF file' : 'Demo image file',
      },
      {
        step: 'classify',
        value: `${label} signal`,
        confidence: 'high',
      },
      {
        step: 'infer',
        value: 'This caption was prewritten for the demo video flow and does not depend on live AI generation.',
        confidence: 'medium',
        isBiased: true,
        biasNote: 'The post is scripted for presentation pacing, not inferred from a real person.',
      },
      {
        step: 'generate',
        value: content,
      },
    ],
    ingredients: [
      {
        label: kind === 'document' ? 'Document evidence' : 'Visual evidence',
        weight: 86,
        dataPoints: [assetBasename],
      },
      {
        label: 'Fake profile',
        weight: 62,
        dataPoints: [step?.user?.displayName || step?.user?.slug || 'Demo user'],
      },
      {
        label: 'Scripted demo',
        weight: 40,
        dataPoints: ['Prewritten caption'],
      },
    ],
    thinking: [
      {
        label: 'WHAT I SAW',
        detail: `I used ${assetBasename} as the visible demo signal.`,
      },
      {
        label: 'THE LEAP',
        detail: `I framed the file as a ${label.toLowerCase()} clue for a fake profile.`,
      },
      {
        label: 'WHY THIS POST',
        detail: 'This post is scripted so the demo button can show posting activity without contacting LM Studio.',
      },
    ],
    attachedAsset: {
      kind,
      filename: assetBasename,
      mime: MIME_BY_EXT[extname(assetBasename)] || (kind === 'document' ? 'application/pdf' : 'image/jpeg'),
      url,
      relativePath: `public${DEMO_VIDEO_CONTENT_PATH}/${assetBasename}`,
      ...(kind === 'image' ? { visionAnalysed: false } : {}),
    },
  };
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
 * Static demo-video feed. Reveals one prewritten post at a time, then exits
 * after the schedule is exhausted.
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

  try {
    for (let index = 0; index < steps.length && shouldContinue(); index += 1) {
      const step = steps[index];
      const post = materializeDemoVideoPost(step, index);
      if (!post) continue;
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

      if (index < steps.length - 1) await sleep(revealGapMs);
    }
  } finally {
    for (const step of steps) {
      spectateController?.setExpectedRevealKey?.(step.user.slug, null);
    }
    spectateController?.setIngestAllowSlugs?.(null);
    onGeneratingPersona?.(null);
  }
}
