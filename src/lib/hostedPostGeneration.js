import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { readApiPersonaPosts } from '@/lib/profileReload.js';
import {
  createPostFeedRevealQueue,
  expectedGeneratedKeysFromJobPosts,
  sleep,
  sortPostsForReveal,
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

/**
 * Poll hosted API + worker job while stagger-revealing new posts into profile state.
 */
export async function runHostedPostGenerationWithReveal({
  jobId,
  reloadProfileFromApi,
  applyRevealedPosts,
  getBaselinePosts,
  pollMs = 1000,
  timeoutMs = 180000,
}) {
  const queue = createPostFeedRevealQueue({
    getBaseline: getBaselinePosts,
    onPostsChange: applyRevealedPosts,
  });
  queue.markBaseline(getBaselinePosts());

  let jobDone = !jobId;
  let jobFailed = null;
  let expectedRevealKeys = [];
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (jobId && !jobDone) {
      const job = await fetchGenerationJob(jobId);
      if (job.status === 'complete') {
        jobDone = true;
        expectedRevealKeys = expectedGeneratedKeysFromJobPosts(job.posts);
      } else if (job.status === 'failed') {
        jobFailed = job.error || 'AI job failed';
        break;
      }
    }

    const reloadResult = await reloadProfileFromApi({ skipPostsMerge: true });
    const apiPosts = readApiPersonaPosts(reloadResult);
    queue.enqueue(sortPostsForReveal(queue.findUnrevealed(apiPosts)));

    const generationComplete =
      jobDone
      && queue.isIdle()
      && queue.hasRevealedAll(expectedRevealKeys)
      && queue.allNewGeneratedRevealed(apiPosts);

    if (generationComplete) break;
    await sleep(pollMs);
  }

  if (jobFailed) throw new Error(jobFailed);
  if (!jobDone) {
    throw new Error('Generation timed out — is your AI PC worker running?');
  }

  await queue.waitUntilIdle();
  return reloadProfileFromApi({ skipPostsMerge: false, forcePostsMerge: true });
}
