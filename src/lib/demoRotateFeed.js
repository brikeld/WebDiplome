import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { queueDemoSinglePost } from '@/lib/demoRotateApi.js';
import { sleep } from '@/lib/postFeedRevealQueue.js';

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

/**
 * Queue one demo post, poll until the worker finishes, then reveal it on the
 * home feed with the standard enter animation before returning.
 */
export async function runDemoRotateSinglePost({
  profileSlug,
  reloadProfileFromApi,
  spectateController,
  pollMs = 1000,
  timeoutMs = 300000,
  postJobDoneGraceMs = 8000,
}) {
  const slug = String(profileSlug || '').trim();
  if (!slug) throw new Error('Profile slug required');

  let created = null;
  let jobId = null;
  const queueStart = Date.now();
  while (Date.now() - queueStart < timeoutMs) {
    created = await queueDemoSinglePost(slug);
    jobId = created?.jobId ?? null;
    if (jobId) break;
    if (created?.reason === 'no_harvest_data') {
      throw new Error('No stored harvest data for this profile');
    }
    if (created?.reason === 'excluded_profile') {
      throw new Error('Profile excluded from demo rotate');
    }
    const waitingOnOtherJob =
      created?.reason === 'generation_in_progress' || created?.alreadyQueued;
    if (!waitingOnOtherJob) {
      throw new Error(created?.reason || 'Could not queue demo post');
    }
    await sleep(pollMs);
  }
  if (!jobId) throw new Error('Timed out waiting to queue demo post');

  let jobDone = false;
  let jobDoneAt = 0;
  let jobFailed = null;
  let revealStarted = false;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (!jobDone) {
      const job = await fetchGenerationJob(jobId);
      if (job.status === 'complete') {
        jobDone = true;
        jobDoneAt = Date.now();
      } else if (job.status === 'failed') {
        jobFailed = job.error || 'AI job failed';
        break;
      }
    }

    await reloadProfileFromApi({ preservePersonaPostsForSlugs: [slug] });

    if (!revealStarted && spectateController && !spectateController.isSlugIdle(slug)) {
      revealStarted = true;
    }

    const stalled = jobDone && Date.now() - jobDoneAt >= postJobDoneGraceMs;
    const idle = spectateController?.isSlugIdle?.(slug) ?? true;

    if (jobDone && revealStarted && idle) break;
    if (jobDone && stalled) break;

    await sleep(pollMs);
  }

  if (jobFailed) throw new Error(jobFailed);
  if (!jobDone) {
    throw new Error('Demo generation timed out — is your AI PC worker running?');
  }

  if (spectateController?.waitForSlugIdle) {
    await spectateController.waitForSlugIdle(slug, { waitForEnterAnimation: true });
  }

  return reloadProfileFromApi({ forcePostsMerge: true });
}
