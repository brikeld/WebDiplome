import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { queueDemoSinglePost } from '@/lib/demoRotateApi.js';
import {
  POST_FEED_ENTER_ANIM_MS,
  POST_REVEAL_GAP_MS,
  sleep,
} from '@/lib/postFeedRevealQueue.js';

const API_ORIGIN = resolveApiOrigin();

const DEMO_JOB_POLL_MS = 400;
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

async function waitForJobComplete(jobId, { pollMs = DEMO_JOB_POLL_MS, timeoutMs = 300000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await fetchGenerationJob(jobId);
    if (job.status === 'complete') return job;
    if (job.status === 'failed') {
      throw new Error(job.error || 'Demo generation failed');
    }
    await sleep(pollMs);
  }
  throw new Error('Demo generation timed out — is your AI PC worker running?');
}

async function queueDemoJobForSlug(slug, { pollMs, timeoutMs }) {
  const start = Date.now();
  let generatingPersona = null;
  while (Date.now() - start < timeoutMs) {
    const created = await queueDemoSinglePost(slug);
    if (created?.generatingPersona) generatingPersona = created.generatingPersona;
    if (created?.jobId) {
      return { slug, jobId: created.jobId, generatingPersona };
    }
    if (created?.reason === 'no_harvest_data' || created?.reason === 'excluded_profile') {
      console.warn(`[demo-rotate] skip ${slug}: ${created.reason}`);
      return null;
    }
    const waiting =
      created?.reason === 'generation_in_progress' || created?.alreadyQueued;
    if (!waiting) {
      console.warn(`[demo-rotate] queue ${slug} failed:`, created?.reason || 'unknown');
      return null;
    }
    await sleep(pollMs);
  }
  console.warn(`[demo-rotate] timed out queueing ${slug}`);
  return null;
}

async function waitForRevealStart(slug, {
  reloadProfileFromApi,
  spectateController,
  pollMs = DEMO_REVEAL_POLL_MS,
  timeoutMs = 60000,
  allSlugs = [],
}) {
  const preserveOthers = allSlugs
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry && entry !== String(slug));
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    spectateController?.setIngestAllowSlugs?.([slug]);
    await reloadProfileFromApi({ preservePersonaPostsForSlugs: preserveOthers });
    if (spectateController && !spectateController.isSlugIdle(slug)) return;
    await sleep(pollMs);
  }
  throw new Error(`Timed out waiting for feed reveal (${slug})`);
}

async function revealSlugInOrder(entry, {
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
    await sleep(POST_REVEAL_GAP_MS);
  } finally {
    spectateController?.setIngestAllowSlugs?.([]);
  }
}

/**
 * Queue one post per demo profile, then reveal each in round order as soon as its
 * job finishes — one animated post at a time, worker may pipeline queued jobs.
 */
export async function runDemoRotateRound({
  targets,
  reloadProfileFromApi,
  spectateController,
  onGeneratingPersona,
  pollMs = DEMO_JOB_POLL_MS,
  timeoutMs = 300000,
}) {
  const list = (Array.isArray(targets) ? targets : [])
    .map((entry) => ({
      slug: String(entry?.slug ?? '').trim(),
      generatingPersona: entry?.generatingPersona ?? null,
    }))
    .filter((entry) => entry.slug);

  if (list.length === 0) throw new Error('No demo profiles available');

  spectateController?.setIngestAllowSlugs?.([]);

  const queued = (
    await Promise.all(
      list.map((entry) => queueDemoJobForSlug(entry.slug, { pollMs, timeoutMs })),
    )
  ).filter(Boolean);

  if (queued.length === 0) throw new Error('No demo posts queued (missing harvest data?)');

  const jobsBySlug = new Map(queued.map((job) => [job.slug, job]));
  const ordered = list
    .filter((entry) => jobsBySlug.has(entry.slug))
    .map((entry) => ({
      slug: entry.slug,
      jobId: jobsBySlug.get(entry.slug).jobId,
      generatingPersona:
        jobsBySlug.get(entry.slug).generatingPersona ?? entry.generatingPersona,
    }));

  const allSlugs = ordered.map((entry) => entry.slug);

  const showSpinner = (index) => {
    onGeneratingPersona?.(demoSpinnerPersonaForIndex(ordered, index));
  };

  let revealedCount = 0;

  try {
    for (let i = 0; i < ordered.length; i += 1) {
      showSpinner(i);

      try {
        const job = await waitForJobComplete(ordered[i].jobId, { pollMs, timeoutMs });
        const resolvedPersona = personaFromGenerationJob(job) ?? ordered[i].generatingPersona;
        if (resolvedPersona) ordered[i].generatingPersona = resolvedPersona;
        showSpinner(i);

        await revealSlugInOrder(ordered[i], {
          reloadProfileFromApi,
          spectateController,
          allSlugs,
        });
        revealedCount += 1;
      } catch (err) {
        console.warn(`[demo-rotate] ${ordered[i].slug}:`, err?.message || err);
        spectateController?.setIngestAllowSlugs?.([]);
      }
    }

    if (revealedCount === 0) {
      throw new Error('No demo posts revealed this round');
    }

    onGeneratingPersona?.(null);
    await reloadProfileFromApi({ preservePersonaPostsForSlugs: allSlugs });
  } finally {
    spectateController?.setIngestAllowSlugs?.(null);
  }
}
