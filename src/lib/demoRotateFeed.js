import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { queueDemoSinglePost } from '@/lib/demoRotateApi.js';
import {
  POST_FEED_ENTER_ANIM_MS,
  sleep,
} from '@/lib/postFeedRevealQueue.js';

const API_ORIGIN = resolveApiOrigin();

export const DEMO_PIPELINE_SIZE = 4;
export const DEMO_PIPELINE_POLL_MS = 350;
export const DEMO_REVEAL_GAP_MS = 2000;
const DEMO_REVEAL_POLL_MS = 200;

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

/** Round-robin pick while skipping slugs that already have an in-flight job. */
export function pickSlugForPipeline(slugs, cursor, inFlightBySlug) {
  const list = Array.isArray(slugs) ? slugs.filter(Boolean) : [];
  if (list.length === 0) return { slug: null, nextCursor: 0 };
  const busy = inFlightBySlug instanceof Set ? inFlightBySlug : new Set();
  for (let step = 0; step < list.length; step += 1) {
    const idx = (cursor + step) % list.length;
    const slug = list[idx];
    if (!busy.has(slug)) {
      return { slug, nextCursor: (idx + 1) % list.length };
    }
  }
  return { slug: null, nextCursor: cursor % list.length };
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

/**
 * One queue attempt — returns immediately (no long wait loops).
 * `blocked` = profile already has a posts-single job; try another slug.
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

async function waitForRevealStart(slug, {
  reloadProfileFromApi,
  spectateController,
  allSlugs = [],
}) {
  const preserveOthers = allSlugs
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry && entry !== String(slug));
  const start = Date.now();
  const timeoutMs = 90000;
  while (Date.now() - start < timeoutMs) {
    spectateController?.setIngestAllowSlugs?.([slug]);
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
    await waitForRevealStart(slug, {
      reloadProfileFromApi,
      spectateController,
      allSlugs,
    });
    if (spectateController?.waitForSlugIdle) {
      await spectateController.waitForSlugIdle(slug, { waitForEnterAnimation: true });
    } else {
      await sleep(POST_FEED_ENTER_ANIM_MS);
    }
  } finally {
    spectateController?.setIngestAllowSlugs?.([]);
  }
}

/**
 * Keep `pipelineSize` LM jobs in flight (worker concurrency must match).
 * Reveal finished posts one at a time with `revealGapMs` between feed entries.
 * Runs until `shouldContinue()` returns false — errors never stop the loop.
 */
export async function runDemoRotatePipeline({
  targets,
  reloadProfileFromApi,
  spectateController,
  onGeneratingPersona,
  shouldContinue = () => true,
  pipelineSize = DEMO_PIPELINE_SIZE,
  revealGapMs = DEMO_REVEAL_GAP_MS,
  pollMs = DEMO_PIPELINE_POLL_MS,
}) {
  const slugs = (Array.isArray(targets) ? targets : [])
    .map((entry) => String(entry?.slug ?? entry ?? '').trim())
    .filter(Boolean);

  if (slugs.length === 0) throw new Error('No demo profiles available');

  const allSlugs = [...slugs];
  const inFlight = new Map();
  const revealQueue = [];
  let slugCursor = 0;
  let revealing = false;
  let refillLock = false;
  let skippedSlugs = new Set();

  const busySlugs = () => new Set([...inFlight.values()].map((e) => e.slug));

  const updateSpinner = () => {
    const nextReveal = revealQueue[0];
    const nextFlight = [...inFlight.values()][0];
    onGeneratingPersona?.(
      nextReveal?.generatingPersona ?? nextFlight?.generatingPersona ?? null,
    );
  };

  const ensurePipelineFull = async () => {
    if (refillLock || !shouldContinue()) return;
    refillLock = true;
    try {
      let attempts = 0;
      const maxAttempts = Math.max(slugs.length * 4, pipelineSize * 3);
      while (inFlight.size < pipelineSize && shouldContinue() && attempts < maxAttempts) {
        attempts += 1;
        const pick = pickSlugForPipeline(slugs, slugCursor, busySlugs());
        slugCursor = pick.nextCursor;
        if (!pick.slug) {
          await sleep(pollMs);
          continue;
        }
        if (skippedSlugs.has(pick.slug)) continue;

        const outcome = await tryQueueDemoPost(pick.slug);
        if (outcome.kind === 'queued') {
          inFlight.set(outcome.jobId, {
            slug: outcome.slug,
            jobId: outcome.jobId,
            generatingPersona: outcome.generatingPersona,
          });
          attempts = 0;
          updateSpinner();
          continue;
        }
        if (outcome.kind === 'blocked') {
          if (outcome.jobId && !inFlight.has(outcome.jobId)) {
            inFlight.set(outcome.jobId, {
              slug: outcome.slug,
              jobId: outcome.jobId,
              generatingPersona: outcome.generatingPersona,
            });
            attempts = 0;
            updateSpinner();
          }
          continue;
        }
        if (outcome.reason === 'no_harvest_data' || outcome.reason === 'excluded_profile') {
          skippedSlugs.add(pick.slug);
          console.warn(`[demo-rotate] skip ${pick.slug}: ${outcome.reason}`);
        }
      }
    } finally {
      refillLock = false;
    }
  };

  spectateController?.setIngestAllowSlugs?.([]);

  try {
    await ensurePipelineFull();
    updateSpinner();

    while (shouldContinue()) {
      try {
        for (const [jobId, entry] of [...inFlight.entries()]) {
          const job = await fetchGenerationJob(jobId);
          if (job.status === 'complete') {
            inFlight.delete(jobId);
            const persona = personaFromGenerationJob(job) ?? entry.generatingPersona;
            revealQueue.push({
              slug: entry.slug,
              jobId,
              generatingPersona: persona,
            });
            ensurePipelineFull();
          } else if (job.status === 'failed') {
            inFlight.delete(jobId);
            console.warn(`[demo-rotate] job failed for ${entry.slug}:`, job.error || 'unknown');
            ensurePipelineFull();
          }
        }

        if (!revealing && revealQueue.length > 0) {
          revealing = true;
          const item = revealQueue.shift();
          updateSpinner();
          try {
            await revealCompletedPost(item, {
              reloadProfileFromApi,
              spectateController,
              allSlugs,
            });
          } catch (err) {
            console.warn(`[demo-rotate] reveal ${item.slug}:`, err?.message || err);
          } finally {
            revealing = false;
          }
          updateSpinner();
          await sleep(revealGapMs);
        }

        if (inFlight.size < pipelineSize) {
          await ensurePipelineFull();
        }
      } catch (err) {
        console.warn('[demo-rotate] pipeline tick:', err?.message || err);
      }

      await sleep(pollMs);
    }
  } finally {
    spectateController?.setIngestAllowSlugs?.(null);
    onGeneratingPersona?.(null);
  }
}

/** @deprecated Use runDemoRotatePipeline */
export async function runDemoRotateRound(args) {
  return runDemoRotatePipeline({
    ...args,
    shouldContinue: () => true,
    pipelineSize: Math.min(DEMO_PIPELINE_SIZE, (args.targets?.length ?? 1)),
  });
}
