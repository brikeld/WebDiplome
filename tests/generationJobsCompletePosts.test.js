import express from 'express';
import { describe, expect, it } from 'vitest';
import { createGenerationJobRoutes } from '../server/routes/generationJobRoutes.js';
import { postIdentityKey } from '../src/lib/mergePersonaPosts.js';

const WORKER_TOKEN = 'test-worker-token';

function buildApp({ jobRow, insertedPosts }) {
  const calls = { appendPosts: [], completeJob: [] };
  const jobStore = {
    async getJobById(id) {
      return id === jobRow.id ? jobRow : null;
    },
    async completeJob(args) {
      calls.completeJob.push(args);
      return { ...jobRow, status: 'complete' };
    },
    mapJobRow: (row) => row,
  };
  const profileStore = {
    async appendPosts(args) {
      calls.appendPosts.push(args);
      return insertedPosts;
    },
    async updateProfileSummary() {},
    async savePersonaBlurbs() {},
  };
  const router = createGenerationJobRoutes({
    config: { aiWorkerToken: WORKER_TOKEN },
    supabaseService: {},
    profileStore,
    jobStore,
    storageStore: null,
  });
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return { app, calls };
}

async function postComplete(app, jobId, body) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/worker/jobs/${jobId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-worker-token': WORKER_TOKEN },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const workerPost = {
  persona: 'securite',
  content: 'un nouveau post généré',
  sentiment: 'positive',
  createdAt: '2026-06-10T10:00:00.000Z',
};

// What Supabase hands back after insert: its own uuid id + reserialized timestamp.
const insertedPost = {
  id: 'db-uuid-1',
  persona: 'securite',
  content: 'un nouveau post généré',
  sentiment: 'positive',
  createdAt: '2026-06-10T10:00:00+00:00',
  source: 'generated',
};

describe('POST /worker/jobs/:id/complete (posts family)', () => {
  it('stores the inserted DB rows in the job result so post identity keys match the public API', async () => {
    const jobRow = {
      id: 'job-1',
      profile_id: 'profile-1',
      user_id: 'user-1',
      status: 'claimed',
      request_payload: { jobType: 'posts-single' },
    };
    const { app, calls } = buildApp({ jobRow, insertedPosts: [insertedPost] });

    const { status } = await postComplete(app, 'job-1', { posts: [workerPost] });

    expect(status).toBe(200);
    expect(calls.appendPosts).toHaveLength(1);
    expect(calls.appendPosts[0]).toMatchObject({
      profileId: 'profile-1',
      userId: 'user-1',
      source: 'generated',
    });

    expect(calls.completeJob).toHaveLength(1);
    const storedPosts = calls.completeJob[0].posts;
    expect(storedPosts).toHaveLength(1);
    // The demo-rotate reveal gate compares postIdentityKey(job.posts[0]) against
    // the posts returned by GET /api/profiles. Both must resolve to the DB id.
    expect(postIdentityKey(storedPosts[0])).toBe(postIdentityKey(insertedPost));
    expect(storedPosts[0].id).toBe('db-uuid-1');
  });

  it('keeps finalizeOnly completions from re-appending posts', async () => {
    const jobRow = {
      id: 'job-2',
      profile_id: 'profile-1',
      user_id: 'user-1',
      status: 'claimed',
      request_payload: { jobType: 'posts' },
    };
    const { app, calls } = buildApp({ jobRow, insertedPosts: [insertedPost] });

    const { status } = await postComplete(app, 'job-2', {
      posts: [workerPost],
      finalizeOnly: true,
    });

    expect(status).toBe(200);
    expect(calls.appendPosts).toHaveLength(0);
    expect(calls.completeJob).toHaveLength(1);
  });
});
