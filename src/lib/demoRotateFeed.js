import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { queueDemoSinglePost } from '@/lib/demoRotateApi.js';
import {
  POST_FEED_ENTER_ANIM_MS,
  POST_REVEAL_GAP_MS,
  sleep,
} from '@/lib/postFeedRevealQueue.js';

const API_ORIGIN = resolveApiOrigin();

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
      return null;
    }
    const waiting =
      created?.reason === 'generation_in_progress' || created?.alreadyQueued;
    if (!waiting) {
      throw new Error(created?.reason || 'Could not queue demo post');
    }
    await sleep(pollMs);
  }
  throw new Error(`Timed out waiting to queue demo post for ${slug}`);
}

async function waitForRevealStart(slug, { reloadProfileFromApi, spectateController, pollMs, timeoutMs }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await reloadProfileFromApi({ preservePersonaPostsForSlugs: [slug] });
    if (spectateController && !spectateController.isSlugIdle(slug)) return;
    await sleep(pollMs);
  }
}

async function revealSlugInOrder(slug, {
  reloadProfileFromApi,
  spectateController,
  pollMs,
  timeoutMs,
}) {
  await waitForRevealStart(slug, { reloadProfileFromApi, spectateController, pollMs, timeoutMs });
  if (spectateController?.waitForSlugIdle) {
    await spectateController.waitForSlugIdle(slug, { waitForEnterAnimation: true });
  } else {
    await sleep(POST_FEED_ENTER_ANIM_MS);
  }
  await sleep(POST_REVEAL_GAP_MS);
}

/**
 * Queue one post per demo profile in parallel, then reveal each in round order
 * with the standard feed enter animation and gap between posts.
 */
export async function runDemoRotateRound({
  targets,
  reloadProfileFromApi,
  spectateController,
  onGeneratingPersona,
  pollMs = 1000,
  timeoutMs = 300000,
}) {
  const list = (Array.isArray(targets) ? targets : [])
    .map((entry) => ({
      slug: String(entry?.slug ?? '').trim(),
      generatingPersona: entry?.generatingPersona ?? null,
    }))
    .filter((entry) => entry.slug);

  if (list.length === 0) throw new Error('No demo profiles available');

  const queued = (
    await Promise.all(
      list.map((entry) => queueDemoJobForSlug(entry.slug, { pollMs, timeoutMs })),
    )
  ).filter(Boolean);

  if (queued.length === 0) throw new Error('No demo posts queued');

  const jobsBySlug = new Map(queued.map((job) => [job.slug, job]));
  const ordered = list
    .filter((entry) => jobsBySlug.has(entry.slug))
    .map((entry) => ({
      slug: entry.slug,
      jobId: jobsBySlug.get(entry.slug).jobId,
      generatingPersona:
        jobsBySlug.get(entry.slug).generatingPersona ?? entry.generatingPersona,
    }));

  const completed = new Set();
  let revealed = 0;

  const syncSpinner = () => {
    const nextIdx = Math.min(revealed, ordered.length - 1);
    const upcomingIdx = Math.min(revealed + 1, ordered.length - 1);
    const stillGenerating = ordered.some((entry) => !completed.has(entry.slug));
    const persona = stillGenerating
      ? (ordered[upcomingIdx]?.generatingPersona ?? ordered[nextIdx]?.generatingPersona)
      : null;
    onGeneratingPersona?.(persona);
  };

  syncSpinner();

  const pollStart = Date.now();
  while (completed.size < ordered.length && Date.now() - pollStart < timeoutMs) {
    await Promise.all(
      ordered.map(async (entry) => {
        if (completed.has(entry.slug)) return;
        const job = await fetchGenerationJob(entry.jobId);
        if (job.status === 'complete') completed.add(entry.slug);
        if (job.status === 'failed') {
          throw new Error(job.error || `Demo generation failed for ${entry.slug}`);
        }
      }),
    );

    while (revealed < ordered.length && completed.has(ordered[revealed].slug)) {
      syncSpinner();
      await revealSlugInOrder(ordered[revealed].slug, {
        reloadProfileFromApi,
        spectateController,
        pollMs,
        timeoutMs,
      });
      revealed += 1;
      syncSpinner();
    }

    if (completed.size < ordered.length) {
      syncSpinner();
      await sleep(pollMs);
    }
  }

  if (completed.size < ordered.length) {
    throw new Error('Demo generation timed out — is your AI PC worker running?');
  }

  return reloadProfileFromApi({ forcePostsMerge: true });
}
