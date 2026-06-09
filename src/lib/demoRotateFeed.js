import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { queueDemoSinglePost } from '@/lib/demoRotateApi.js';
import { postIdentityKey } from '@/lib/mergePersonaPosts.js';
import {
  POST_FEED_ENTER_ANIM_MS,
  sleep,
} from '@/lib/postFeedRevealQueue.js';

const API_ORIGIN = resolveApiOrigin();

export const DEMO_REVEAL_GAP_MS = 2000;
const DEMO_JOB_POLL_MS = 400;
const DEMO_REVEAL_POLL_MS = 200;
const DEMO_QUEUE_RETRY_MS = 500;

/** Stable demo order: alphabetical by display name, then slug. */
export function sortDemoTargets(targets) {
  return [...(Array.isArray(targets) ? targets : [])]
    .map((entry) => ({
      slug: String(entry?.slug ?? '').trim(),
      displayName: String(entry?.displayName ?? entry?.slug ?? '').trim(),
    }))
    .filter((entry) => entry.slug)
    .sort((a, b) => {
      const byName = a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
      if (byName !== 0) return byName;
      return a.slug.localeCompare(b.slug);
    });
}

/** Persona key for the post at `index` in the demo reveal order. */
export function demoSpinnerPersonaForIndex(ordered, index) {
  if (!Array.isArray(ordered) || index < 0 || index >= ordered.length) return null;
  return ordered[index]?.generatingPersona ?? null;
}

/** Read persona from a completed generation job (French keys from worker). */
export function personaFromGenerationJob(job) {
  const posts = Array.isArray(job?.posts) ? job.posts : job?.result;
  if (!Array.isArray(posts) || posts.length === 0) return null;
  const persona = posts[0]?.persona;
  return persona ? String(persona) : null;
}

export function postKeyFromGenerationJob(job) {
  const posts = Array.isArray(job?.posts) ? job.posts : job?.result;
  if (!Array.isArray(posts) || posts.length === 0) return null;
  return postIdentityKey(posts[0]) || null;
}

async function fetchGenerationJob(jobId) {
  const res = await fetch(`${API_ORIGIN}/api/generation-jobs/${encodeURIComponent(jobId)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText.slice(0, 200) || `Job poll failed (${res.status})`);
  }
  const { job } = await res.json();
  if (!job) throw new Error('Job not found');
  return job;
}

async function waitForJobComplete(jobId, { shouldContinue, pollMs = DEMO_JOB_POLL_MS, timeoutMs = 300000 } = {}) {
  const start = Date.now();
  while (shouldContinue() && Date.now() - start < timeoutMs) {
    const job = await fetchGenerationJob(jobId);
    if (job.status === 'complete') return job;
    if (job.status === 'failed') {
      throw new Error(job.error || 'Demo generation failed');
    }
    await sleep(pollMs);
  }
  throw new Error('Demo generation timed out — is your AI PC worker running?');
}

/**
 * One queue attempt — returns immediately (no long wait loops).
 */
export async function tryQueueDemoPost(slug) {
  const key = String(slug || '').trim();
  if (!key) return { kind: 'skip' };

  const created = await queueDemoSinglePost(key);
  if (created?.jobId) {
    return {
      kind: 'queued',
      slug: key,
      jobId: created.jobId,
      generatingPersona: created.generatingPersona ?? null,
    };
  }
  if (created?.reason === 'no_harvest_data' || created?.reason === 'excluded_profile') {
    return { kind: 'skip', slug: key, reason: created.reason };
  }
  if (created?.reason === 'generation_in_progress' || created?.alreadyQueued) {
    return {
      kind: 'blocked',
      slug: key,
      jobId: created?.jobId ?? null,
      generatingPersona: created?.generatingPersona ?? null,
    };
  }
  return { kind: 'skip', slug: key, reason: created?.reason ?? 'queue_failed' };
}

async function queueDemoPostWithRetry(slug, { shouldContinue, timeoutMs = 120000 }) {
  const start = Date.now();
  while (shouldContinue() && Date.now() - start < timeoutMs) {
    const outcome = await tryQueueDemoPost(slug);
    if (outcome.kind === 'queued') return outcome;
    if (outcome.reason === 'no_harvest_data' || outcome.reason === 'excluded_profile') {
      return null;
    }
    if (outcome.kind === 'blocked' && outcome.jobId) {
      return {
        kind: 'queued',
        slug: outcome.slug,
        jobId: outcome.jobId,
        generatingPersona: outcome.generatingPersona,
      };
    }
    await sleep(DEMO_QUEUE_RETRY_MS);
  }
  return null;
}

async function waitForRevealStart(slug, {
  reloadProfileFromApi,
  spectateController,
  allSlugs = [],
  postKey = null,
}) {
  const preserveOthers = allSlugs
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry && entry !== String(slug));
  const start = Date.now();
  const timeoutMs = 90000;
  while (Date.now() - start < timeoutMs) {
    spectateController?.setIngestAllowSlugs?.([slug]);
    if (postKey) spectateController?.setExpectedRevealKey?.(slug, postKey);
    await reloadProfileFromApi({ preservePersonaPostsForSlugs: preserveOthers });
    if (spectateController && !spectateController.isSlugIdle(slug)) return;
    await sleep(DEMO_REVEAL_POLL_MS);
  }
  throw new Error(`Timed out waiting for feed reveal (${slug})`);
}

async function revealCompletedPost(entry, {
  reloadProfileFromApi,
  spectateController,
  allSlugs,
}) {
  const slug = entry.slug;
  try {
    spectateController?.setIngestAllowSlugs?.([slug]);
    if (entry.postKey) spectateController?.setExpectedRevealKey?.(slug, entry.postKey);
    await waitForRevealStart(slug, {
      reloadProfileFromApi,
      spectateController,
      allSlugs,
      postKey: entry.postKey,
    });
    if (spectateController?.waitForSlugIdle) {
      await spectateController.waitForSlugIdle(slug, { waitForEnterAnimation: true });
    } else {
      await sleep(POST_FEED_ENTER_ANIM_MS);
    }
  } finally {
    spectateController?.setExpectedRevealKey?.(slug, null);
    spectateController?.setIngestAllowSlugs?.([]);
  }
}

/**
 * Strict round-robin: one profile at a time — queue → generate → reveal → next profile.
 * Cycles through every demo user before repeating anyone.
 */
export async function runDemoRotatePipeline({
  targets,
  reloadProfileFromApi,
  spectateController,
  onGeneratingPersona,
  shouldContinue = () => true,
  revealGapMs = DEMO_REVEAL_GAP_MS,
}) {
  const ordered = sortDemoTargets(targets);
  if (ordered.length === 0) throw new Error('No demo profiles available');

  const allSlugs = ordered.map((entry) => entry.slug);
  let cycleIndex = 0;

  spectateController?.setIngestAllowSlugs?.([]);

  try {
    try {
      await reloadProfileFromApi({ preservePersonaPostsForSlugs: allSlugs });
    } catch {
      /* baseline reload is best-effort */
    }

    while (shouldContinue()) {
      const target = ordered[cycleIndex % ordered.length];
      cycleIndex += 1;

      let queued = null;
      try {
        queued = await queueDemoPostWithRetry(target.slug, { shouldContinue });
      } catch (err) {
        console.warn(`[demo-rotate] queue ${target.slug}:`, err?.message || err);
      }

      if (!queued?.jobId) {
        if (queued === null) {
          console.warn(`[demo-rotate] skip ${target.displayName || target.slug} (no harvest)`);
        }
        await sleep(300);
        continue;
      }

      const expectedPersona = queued.generatingPersona ?? null;
      onGeneratingPersona?.(expectedPersona);

      let job = null;
      try {
        job = await waitForJobComplete(queued.jobId, { shouldContinue });
      } catch (err) {
        console.warn(`[demo-rotate] job ${target.slug}:`, err?.message || err);
        await sleep(300);
        continue;
      }

      const persona = personaFromGenerationJob(job) ?? expectedPersona;
      const postKey = postKeyFromGenerationJob(job);
      onGeneratingPersona?.(persona);

      try {
        await revealCompletedPost(
          {
            slug: target.slug,
            generatingPersona: persona,
            postKey,
          },
          {
            reloadProfileFromApi,
            spectateController,
            allSlugs,
          },
        );
      } catch (err) {
        console.warn(`[demo-rotate] reveal ${target.slug}:`, err?.message || err);
      }

      onGeneratingPersona?.(null);
      await sleep(revealGapMs);
    }
  } finally {
    for (const slug of allSlugs) {
      spectateController?.setExpectedRevealKey?.(slug, null);
    }
    spectateController?.setIngestAllowSlugs?.(null);
    onGeneratingPersona?.(null);
  }
}
