import express from 'express';
import { requireHostedUser, requireWorker } from '../lib/auth.js';

export function createGenerationJobRoutes({ config, supabaseService, profileStore, jobStore }) {
  const router = express.Router();
  const requireUser = requireHostedUser(supabaseService);
  const requireAiWorker = requireWorker(config);

  router.post('/generation-jobs', requireUser, async (req, res) => {
    try {
      const slug = String(req.body?.profileSlug || '').trim();
      const profile = slug ? await profileStore.getProfileRowBySlug(slug) : null;
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      if (profile.user_id !== req.authUser.id) return res.status(403).json({ error: 'Profile owner required' });

      const job = await jobStore.createJob({
        userId: req.authUser.id,
        profileId: profile.id,
        requestPayload: req.body?.requestPayload ?? {},
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
      const job = await jobStore.completeJob({ jobId: req.params.id, posts: req.body?.posts ?? [] });
      await profileStore.appendPosts({
        profileId: job.profile_id,
        userId: job.user_id,
        posts: req.body?.posts ?? [],
        source: 'generated',
      });
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
