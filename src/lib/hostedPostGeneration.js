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
  onGenerationPlan,
  onPostRevealed,
  onNextPostChange,
  pollMs = 1000,
  timeoutMs = 120000,
  postJobDoneGraceMs = 12000,
}) {
  let planReported = false;
  const queue = createPostFeedRevealQueue({
    getBaseline: getBaselinePosts,
    onPostsChange: applyRevealedPosts,
    onPostRevealed,
    onNextPostChange,
  });
  queue.markBaseline(getBaselinePosts());

  let jobDone = false;
  let jobDoneAt = 0;
  let jobFailed = null;
  let expectedCount = null;
  // Tracks the highest new-post count seen and when it last increased. Used as
  // a "settle" signal: generation is only done once posts STOP arriving for a
  // while — robust to a worker that writes posts incrementally and/or reports
  // `complete` before all rows are persisted.
  let maxNewCount = 0;
  let lastProgressAt = Date.now();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (jobId && !jobDone) {
      const job = await fetchGenerationJob(jobId);
      if (!planReported && Array.isArray(job.generationPlan) && job.generationPlan.length > 0) {
        planReported = true;
        onGenerationPlan?.(job.generationPlan);
      }
      if (job.status === 'complete') {
        jobDone = true;
        jobDoneAt = Date.now();
        // May be 0/null if the worker doesn't echo posts back in the job
        // record — we must NOT treat "unknown" as "all revealed".
        expectedCount = expectedGeneratedKeysFromJobPosts(job.posts).length || null;
      } else if (job.status === 'failed') {
        jobFailed = job.error || 'AI job failed';
        break;
      }
    }

    const reloadResult = await reloadProfileFromApi({ skipPostsMerge: true });
    const apiPosts = readApiPersonaPosts(reloadResult);
    queue.enqueue(sortPostsForReveal(queue.findUnrevealed(apiPosts)));

    const newGeneratedCount = queue.countNewGeneratedInApi(apiPosts);
    if (newGeneratedCount > maxNewCount) {
      maxNewCount = newGeneratedCount;
      lastProgressAt = Date.now();
    }
    const revealedEverythingSoFar =
      queue.isIdle() && queue.allNewGeneratedRevealed(apiPosts);

    // Floor the expectation: even when the job record omits its posts, never
    // settle before the standard 3 persona posts unless generation has clearly
    // stalled (no new posts for the grace window). This is what stops the run
    // from "completing" the moment the first post reveals.
    const expectedFloor = Math.max(expectedCount ?? 0, EXPECTED_GENERATED_POST_COUNT);
    const reachedExpected = newGeneratedCount >= expectedFloor;
    // CRITICAL: anchor the stall timer to the LATER of last-progress and
    // job-done. The hosted DB has read-after-write lag, so at the poll where
    // the job flips to `complete` the freshly written posts usually have NOT
    // surfaced in the API yet. If we measured the stall from `start`, a run
    // that took longer than the grace window would already be "stalled" and we
    // would bail the instant the job completed — dismissing the generating
    // screen with 0–1 posts revealed and leaving the rest to appear (un
    // animated) only after a manual reload. Re-anchoring to `jobDoneAt` gives
    // the API a fresh grace window to surface the writes after completion.
    const stallAnchor = Math.max(lastProgressAt, jobDoneAt);
    const stalled = Date.now() - stallAnchor >= postJobDoneGraceMs;

    let generationComplete = false;
    if (revealedEverythingSoFar) {
      if (jobId) {
        // Finish only once the expected posts are all revealed AND the job is
        // done — or, as a safety valve, if nothing new has surfaced for the
        // grace window measured from job-done (covers a worker that emits fewer
        // posts than the floor, or never surfaces them).
        generationComplete = reachedExpected ? jobDone : jobDone && stalled;
      } else {
        // No job handle (trigger failed but the worker may still run).
        generationComplete = reachedExpected || stalled;
      }
    }

    if (generationComplete) break;
    await sleep(pollMs);
  }

  if (jobFailed) throw new Error(jobFailed);
  if (jobId && !jobDone) {
    throw new Error('Generation timed out — is your AI PC worker running?');
  }

  await queue.waitUntilIdle();
  return reloadProfileFromApi({ skipPostsMerge: true });
}
