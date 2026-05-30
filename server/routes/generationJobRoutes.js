import express from 'express';
import { requireHostedUser, requireWorker } from '../lib/auth.js';

import { slimProfilePayloadForStorage } from '../lib/publicProfileMapping.js';

function slimGenerationRequestPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const out = { ...payload };
  if (out.profile && typeof out.profile === 'object') {
    out.profile = slimProfilePayloadForStorage(out.profile);
  }
  if (out.data_json && !out.dataJson) {
    out.dataJson = out.data_json;
    delete out.data_json;
  }
  return out;
}

export function createGenerationJobRoutes({ config, supabaseService, profileStore, jobStore }) {
  const router = express.Router();
  const requireUser = requireHostedUser(supabaseService);
  const requireAiWorker = requireWorker(config);

  router.get('/generation-jobs/:id', async (req, res) => {
    try {
      const row = await jobStore.getJobById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Job not found' });
      res.json({ job: jobStore.mapJobRow(row) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/generation-jobs/public', async (req, res) => {
    try {
      const jobType = String(req.body?.jobType || 'comments').trim();
      const payload = req.body?.payload && typeof req.body.payload === 'object'
        ? req.body.payload
        : {};
      const job = await jobStore.createJob({
        userId: null,
        profileId: null,
        requestPayload: { jobType, ...payload },
      });
      res.json({ success: true, jobId: job.id, status: job.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/generation-jobs', requireUser, async (req, res) => {
    try {
      const slug = String(req.body?.profileSlug || '').trim();
      const profile = slug ? await profileStore.getProfileRowBySlug(slug) : null;
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      if (profile.user_id !== req.authUser.id) return res.status(403).json({ error: 'Profile owner required' });

      const requestPayload = slimGenerationRequestPayload(req.body?.requestPayload ?? {});
      requestPayload.jobType = requestPayload.jobType || 'posts';

      const job = await jobStore.createJob({
        userId: req.authUser.id,
        profileId: profile.id,
        requestPayload,
      });
      res.json({ success: true, jobId: job.id, status: job.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/comments/suggest', async (req, res) => {
    try {
      const job = await jobStore.createJob({
        userId: null,
        profileId: null,
        requestPayload: {
          jobType: 'comments',
          post: req.body?.post ?? {},
          allowedPersonas: req.body?.allowedPersonas ?? null,
          profile: req.body?.profile ?? null,
        },
      });
      res.json({ success: true, jobId: job.id, status: job.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/persona-blurbs/generate', async (req, res) => {
    try {
      const job = await jobStore.createJob({
        userId: null,
        profileId: null,
        requestPayload: {
          jobType: 'blurbs',
          scores: req.body?.scores ?? {},
          profile: req.body?.profile ?? null,
        },
      });
      res.json({ success: true, jobId: job.id, status: job.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/profile/generate-summary', requireUser, async (req, res) => {
    try {
      const slug = String(req.body?.profileSlug || '').trim();
      const profile = slug ? await profileStore.getProfileRowBySlug(slug) : null;
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      if (profile.user_id !== req.authUser.id) return res.status(403).json({ error: 'Profile owner required' });

      const job = await jobStore.createJob({
        userId: req.authUser.id,
        profileId: profile.id,
        requestPayload: slimGenerationRequestPayload({
          jobType: 'bio',
          profile: req.body?.profile ?? {},
          dataJson: req.body?.dataJson ?? {},
          user: req.body?.user ?? {},
        }),
      });
      res.json({ success: true, jobId: job.id, status: job.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/worker/jobs/next', requireAiWorker, async (req, res) => {
    try {
      const workerName = String(req.query.worker || 'ai-pc');
      const job = await jobStore.claimNext(workerName);
      res.json({ job });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/worker/jobs/:id/complete', requireAiWorker, async (req, res) => {
    try {
      const jobRow = await jobStore.getJobById(req.params.id);
      if (!jobRow) return res.status(404).json({ error: 'Job not found' });

      const payload = jobRow.request_payload && typeof jobRow.request_payload === 'object'
        ? jobRow.request_payload
        : {};
      const jobType = payload.jobType || 'posts';
      const posts = req.body?.posts ?? [];
      const profileSummary = req.body?.profileSummary ?? req.body?.profile_summary ?? '';
      const result = req.body?.result ?? null;

      const job = await jobStore.completeJob({
        jobId: req.params.id,
        posts: jobType === 'posts' ? posts : undefined,
        result: jobType === 'posts' ? posts : result,
      });

      if (jobType === 'posts' || jobType === 'bio') {
        if (profileSummary) {
          await profileStore.updateProfileSummary({
            profileId: job.profile_id,
            userId: job.user_id,
            profileSummary,
          });
        }
      }

      if (jobType === 'posts' && Array.isArray(posts) && posts.length > 0) {
        await profileStore.appendPosts({
          profileId: job.profile_id,
          userId: job.user_id,
          posts,
          source: 'generated',
        });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/worker/jobs/:id/fail', requireAiWorker, async (req, res) => {
    try {
      await jobStore.failJob({ jobId: req.params.id, error: req.body?.error });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
