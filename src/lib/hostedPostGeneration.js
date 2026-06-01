import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { readApiPersonaPosts } from '@/lib/profileReload.js';
import {
  createPostFeedRevealQueue,
  expectedGeneratedKeysFromJobPosts,
  sleep,
  sortPostsForReveal,
} from '@/lib/postFeedRevealQueue.js';

const API_ORIGIN = resolveApiOrigin();

/** Persona post generator always emits three posts (one per persona). */
const EXPECTED_GENERATED_POST_COUNT = 3;

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
 *
 * Completion is COUNT-based, not key-based: once the worker job reports
 * `complete`, we learn how many posts it produced and wait until that many
 * new posts surface in the API and get revealed. Matching by exact identity
 * key was brittle — a `createdAt` mismatch between the job record and the
 * stored post would wedge the loop until the hard timeout, locking the
 * generate button. A short grace window after `jobDone` prevents waiting
 * forever when the worker legitimately emits fewer posts than the cap (e.g.
 * the leaderboard slot is skipped because the boards are exhausted).
 */
export async function runHostedPostGenerationWithReveal({
  jobId,
  reloadProfileFromApi,
  applyRevealedPosts,
  getBaselinePosts,
  onDismissGeneratingUi,
  onPostRevealed,
  pollMs = 1000,
  timeoutMs = 120000,
  postJobDoneGraceMs = 12000,
}) {
  const queue = createPostFeedRevealQueue({
    getBaseline: getBaselinePosts,
    onPostsChange: applyRevealedPosts,
    onFirstReveal: onDismissGeneratingUi,
    onPostRevealed,
  });
  queue.markBaseline(getBaselinePosts());

  let jobDone = false;
  let jobFailed = null;
  let expectedCount = null;
  let jobDoneAt = 0;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (jobId && !jobDone) {
      const job = await fetchGenerationJob(jobId);
      if (job.status === 'complete') {
        jobDone = true;
        jobDoneAt = Date.now();
        expectedCount = expectedGeneratedKeysFromJobPosts(job.posts).length || null;
        onDismissGeneratingUi?.();
      } else if (job.status === 'failed') {
        jobFailed = job.error || 'AI job failed';
        break;
      }
    }

    const reloadResult = await reloadProfileFromApi({ skipPostsMerge: true });
    const apiPosts = readApiPersonaPosts(reloadResult);
    queue.enqueue(sortPostsForReveal(queue.findUnrevealed(apiPosts)));

    const newGeneratedCount = queue.countNewGeneratedInApi(apiPosts);
    const revealedEverythingSoFar =
      queue.isIdle() && queue.allNewGeneratedRevealed(apiPosts);

    let generationComplete = false;
    if (jobId) {
      if (jobDone && revealedEverythingSoFar) {
        const reachedExpected =
          expectedCount == null || newGeneratedCount >= expectedCount;
        const graceElapsed = Date.now() - jobDoneAt >= postJobDoneGraceMs;
        generationComplete = reachedExpected || graceElapsed;
      }
    } else {
      // No job handle (trigger failed but the worker may still be running):
      // settle once the expected count is revealed, or after a bounded wait.
      generationComplete =
        revealedEverythingSoFar
        && (newGeneratedCount >= EXPECTED_GENERATED_POST_COUNT
          || Date.now() - start >= postJobDoneGraceMs * 2);
    }

    if (generationComplete) break;
    await sleep(pollMs);
  }

  if (jobFailed) throw new Error(jobFailed);
  if (jobId && !jobDone) {
    throw new Error('Generation timed out — is your AI PC worker running?');
  }

  await queue.waitUntilIdle();
  return reloadProfileFromApi({ skipPostsMerge: false, forcePostsMerge: true });
}
