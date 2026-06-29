import express from 'express';
import { describe, expect, it } from 'vitest';
import { createGenerationJobRoutes } from '../server/routes/generationJobRoutes.js';

function buildApp({
  operatorProfile = {
    id: 'brikeld-hoxha',
    profileUuid: 'operator-profile-uuid',
    firstname: 'Brikeld',
    lastname: 'Hoxha',
  },
} = {}) {
  const calls = { createJob: [] };
  const supabaseService = {
    auth: {
      async getUser(token) {
        if (token !== 'valid-token') return { data: null, error: new Error('bad token') };
        return { data: { user: { id: 'operator-user' } }, error: null };
      },
    },
  };
  const jobStore = {
    async createJob(args) {
      calls.createJob.push(args);
      return { id: 'job-demo-video', status: 'queued' };
    },
    async getJobById() { return null; },
    mapJobRow: (row) => row,
  };
  const profileStore = {
    async getProfileByUserId() {
      return operatorProfile;
    },
  };
  const router = createGenerationJobRoutes({
    config: { aiWorkerToken: 'worker-token' },
    supabaseService,
    profileStore,
    jobStore,
    storageStore: null,
  });
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return { app, calls };
}

async function postJson(app, path, body, headers = {}) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('demo-video generation jobs', () => {
  it('queues demo-video jobs only through the operator-authenticated debug endpoint', async () => {
    const { app, calls } = buildApp();

    const { status, json } = await postJson(
      app,
      '/api/debug/demo-video/post',
      {
        assetBasename: 'lake.webp',
        fakeUserName: 'Camille Laurent',
        assetUrl: 'https://web-diplome.vercel.app/videoDEMO/contentFakePeople/lake.webp',
      },
      { authorization: 'Bearer valid-token' },
    );

    expect(status).toBe(200);
    expect(json).toMatchObject({ success: true, jobId: 'job-demo-video', status: 'queued' });
    expect(calls.createJob).toEqual([
      {
        userId: 'operator-user',
        profileId: 'operator-profile-uuid',
        requestPayload: {
          jobType: 'demo-video',
          assetBasename: 'lake.webp',
          fakeUserName: 'Camille Laurent',
          assetUrl: 'https://web-diplome.vercel.app/videoDEMO/contentFakePeople/lake.webp',
        },
      },
    ]);
  });

  it('rejects demo-video asset URLs that do not match the queued basename', async () => {
    const { app, calls } = buildApp();

    const { status, json } = await postJson(
      app,
      '/api/debug/demo-video/post',
      {
        assetBasename: 'lake.webp',
        fakeUserName: 'Camille Laurent',
        assetUrl: 'https://web-diplome.vercel.app/videoDEMO/contentFakePeople/cat.jpg',
      },
      { authorization: 'Bearer valid-token' },
    );

    expect(status).toBe(400);
    expect(json.error).toMatch(/basename mismatch/);
    expect(calls.createJob).toHaveLength(0);
  });

  it('does not allow demo-video jobs through the unauthenticated public queue', async () => {
    const { app, calls } = buildApp();

    const { status } = await postJson(app, '/api/generation-jobs/public', {
      jobType: 'demo-video',
      payload: { assetBasename: 'lake.webp', fakeUserName: 'Camille Laurent' },
    });

    expect(status).toBe(403);
    expect(calls.createJob).toHaveLength(0);
  });
});
