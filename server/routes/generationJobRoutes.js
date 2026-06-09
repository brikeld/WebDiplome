import express from 'express';
import multer from 'multer';
import { requireHostedUser, requireWorker } from '../lib/auth.js';

import { slimProfilePayloadForStorage } from '../lib/publicProfileMapping.js';
import { mergeAssetCandidatePool, nextAssetPersona } from '../lib/pickGenerationAsset.js';
import { resolveCommenterProfileContext, resolveSubjectProfileContext } from '../lib/aiJobProfile.js';
import {
  harvestPayloadHasContent,
  mergeGenerationRequestPayload,
  queueInitialPostsJobIfNeeded,
  queueUpdatePostsJobAfterHarvestSync,
  queueSinglePostJob,
  shouldPatchQueuedGenerationPayload,
} from '../lib/generationQueue.js';
import { isDemoRotateOperator, isDemoRotateTargetProfile } from '../lib/demoRotate.js';
import { resolveDemoSinglePostPersona } from '../lib/demoRotatePersona.js';
import { resolveProfileHarvestDataJson } from '../lib/resolveProfileHarvestData.js';

const workerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

export function createGenerationJobRoutes({ config, supabaseService, profileStore, jobStore, storageStore }) {
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

      const active = await jobStore.findActiveJob({
        profileId: profile.id,
        jobType: requestPayload.jobType,
      });
      if (active) {
        const existingPayload =
          active.request_payload && typeof active.request_payload === 'object'
            ? active.request_payload
            : {};
        const existingData = existingPayload.dataJson ?? existingPayload.data_json;
        const incomingData = requestPayload.dataJson ?? requestPayload.data_json;
        if (
          active.status === 'queued'
          && shouldPatchQueuedGenerationPayload(existingPayload, requestPayload)
        ) {
          const merged = mergeGenerationRequestPayload(existingPayload, requestPayload);
          await jobStore.updateQueuedJobPayload(active.id, merged);
          return res.json({
            success: true,
            jobId: active.id,
            status: active.status,
            payloadUpdated: true,
          });
        }
        return res.json({
          success: true,
          jobId: active.id,
          status: active.status,
          alreadyQueued: true,
        });
      }

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
      const ctx = await resolveCommenterProfileContext(profileStore, req.body, { jobStore });
      if (!ctx.profileId) {
        return res.status(400).json({ error: 'viewerProfileSlug required (unknown viewer profile)' });
      }
      const post = req.body?.post ?? {};
      const postId = String(post?.id ?? post?.postId ?? '').trim();
      const active = await jobStore.findActiveJob({
        profileId: ctx.profileId,
        jobType: 'comments',
        payloadMatch: {
          postId: postId || null,
          viewerProfileSlug: ctx.slug,
        },
      });
      if (active) {
        return res.json({
          success: true,
          jobId: active.id,
          status: active.status,
          alreadyQueued: true,
        });
      }
      const job = await jobStore.createJob({
        userId: ctx.userId,
        profileId: ctx.profileId,
        requestPayload: {
          jobType: 'comments',
          viewerProfileSlug: ctx.slug,
          postId: postId || null,
          post,
          allowedPersonas: req.body?.allowedPersonas ?? null,
          profile: ctx.profileForWorker,
          dataJson: ctx.dataJson,
        },
      });
      res.json({ success: true, jobId: job.id, status: job.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/persona-blurbs/generate', async (req, res) => {
    try {
      const ctx = await resolveSubjectProfileContext(profileStore, req.body, { jobStore });
      if (!ctx.profileId) {
        return res.status(400).json({ error: 'profileSlug required (unknown profile)' });
      }
      if (ctx.personaBlurbs) {
        return res.json({ success: true, blurbs: ctx.personaBlurbs, cached: true });
      }
      const active = await jobStore.findActiveJob({
        profileId: ctx.profileId,
        jobType: 'blurbs',
      });
      if (active) {
        return res.json({
          success: true,
          jobId: active.id,
          status: active.status,
          alreadyQueued: true,
        });
      }
      const job = await jobStore.createJob({
        userId: ctx.userId,
        profileId: ctx.profileId,
        requestPayload: {
          jobType: 'blurbs',
          subjectProfileSlug: ctx.slug,
          scores: req.body?.scores ?? ctx.profileForWorker?.personaScores ?? {},
          profile: ctx.profileForWorker,
          dataJson: ctx.dataJson,
        },
      });
      res.json({ success: true, jobId: job.id, status: job.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/debug/demo-rotate/single', requireUser, async (req, res) => {
    try {
      const operator = await profileStore.getProfileByUserId(req.authUser.id);
      if (!isDemoRotateOperator(operator)) {
        return res.status(403).json({ error: 'Demo rotate restricted' });
      }

      const slug = String(req.body?.profileSlug || '').trim();
      if (!slug) return res.status(400).json({ error: 'profileSlug required' });

      const row = await profileStore.getProfileRowBySlug(slug);
      if (!row) return res.status(404).json({ error: 'Profile not found' });

      const target = await profileStore.getProfileBySlug(slug);
      if (!target) return res.status(404).json({ error: 'Profile not found' });
      if (!isDemoRotateTargetProfile(target)) {
        return res.status(403).json({ error: 'Profile excluded from demo rotate' });
      }

      const ctx = await resolveSubjectProfileContext(
        profileStore,
        { profileSlug: slug },
        { jobStore },
      );
      let dataJson = ctx.dataJson;
      if (!harvestPayloadHasContent(dataJson)) {
        dataJson = await resolveProfileHarvestDataJson(
          row.raw_profile,
          row.id,
          jobStore,
          { profileRow: row, apiProfile: target, allowSynthesize: true },
        );
      }
      if (!harvestPayloadHasContent(dataJson)) {
        return res.status(400).json({ error: 'No stored harvest data for profile', reason: 'no_harvest_data' });
      }

      const generatingPersona = await resolveDemoSinglePostPersona({
        profile: target,
        dataJson,
      });

      const outcome = await queueSinglePostJob({
        profileStore,
        jobStore,
        profileSlug: slug,
        syncDataJson: dataJson,
      });

      const personaPayload = generatingPersona ? { generatingPersona } : {};

      if (outcome.alreadyQueued) {
        return res.json({
          success: true,
          alreadyQueued: true,
          jobId: outcome.jobId,
          status: outcome.status,
          ...personaPayload,
        });
      }
      if (!outcome.queued) {
        const status = outcome.reason === 'generation_in_progress' ? 409 : 400;
        return res.status(status).json({
          error: outcome.reason || 'Could not queue demo post',
          reason: outcome.reason ?? null,
          alreadyQueued: outcome.alreadyQueued ?? false,
          jobId: outcome.jobId ?? null,
          status: outcome.status ?? null,
          ...personaPayload,
        });
      }
      if (generatingPersona && outcome.jobId) {
        await jobStore.patchRequestPayload(outcome.jobId, { generatingPersona });
      }
      res.json({ success: true, jobId: outcome.jobId, status: outcome.status, ...personaPayload });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/generation-jobs/trigger-initial', requireUser, async (req, res) => {
    try {
      const slug = String(req.body?.profileSlug || '').trim();
      const row = slug ? await profileStore.getProfileRowBySlug(slug) : null;
      if (!row) return res.status(404).json({ error: 'Profile not found' });
      if (row.user_id !== req.authUser.id) {
        return res.status(403).json({ error: 'Profile owner required' });
      }

      const outcome = await queueInitialPostsJobIfNeeded({
        profileStore,
        jobStore,
        profileSlug: slug,
        userId: req.authUser.id,
      });

      if (outcome.alreadyComplete) {
        return res.json({ success: true, alreadyComplete: true });
      }
      if (outcome.alreadyQueued) {
        return res.json({
          success: true,
          alreadyQueued: true,
          jobId: outcome.jobId,
          status: outcome.status,
        });
      }
      if (!outcome.queued) {
        return res.status(400).json({ error: outcome.reason || 'Could not queue generation' });
      }
      res.json({ success: true, jobId: outcome.jobId, status: outcome.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/generation-jobs/trigger-update', async (req, res) => {
    try {
      const slug = String(req.body?.profileSlug || '').trim();
      const row = slug ? await profileStore.getProfileRowBySlug(slug) : null;
      if (!row) return res.status(404).json({ error: 'Profile not found' });

      const active = await jobStore.findActiveJob({ profileId: row.id, jobType: 'posts' });
      if (active) {
        return res.json({
          success: true,
          alreadyQueued: true,
          jobId: active.id,
          status: active.status ?? 'queued',
        });
      }

      const syncDataJson = req.body?.dataJson ?? req.body?.data_json ?? null;
      const ctx = await resolveSubjectProfileContext(
        profileStore,
        { profileSlug: slug, dataJson: syncDataJson },
        { jobStore },
      );
      const dataJson = harvestPayloadHasContent(syncDataJson) ? syncDataJson : ctx.dataJson;
      if (!harvestPayloadHasContent(dataJson)) {
        return res.status(400).json({
          error: 'No harvest data available — run harvest from the Compliant desktop app first.',
        });
      }

      const profileRow = await profileStore.getProfileRowBySlug(slug);
      const storedPool = profileRow?.raw_profile?.generationAssetCandidates ?? [];
      const latest = await jobStore.findLatestJobPayload(row.id, 'posts');
      const priorPool = latest?.request_payload?.assetCandidates ?? [];
      const incomingPool = req.body?.generationAssetCandidates ?? req.body?.assetCandidates ?? [];
      const assetCandidates = mergeAssetCandidatePool(storedPool, [...priorPool, ...incomingPool]);

      const outcome = await queueUpdatePostsJobAfterHarvestSync({
        profileStore,
        jobStore,
        profileSlug: slug,
        syncDataJson: dataJson,
        assetCandidates: assetCandidates.length > 0 ? assetCandidates : null,
        assetPersona: req.body?.assetPersona ?? null,
      });

      if (outcome.alreadyQueued || outcome.payloadUpdated) {
        return res.json({
          success: true,
          alreadyQueued: true,
          jobId: outcome.jobId,
          status: outcome.status,
        });
      }
      if (!outcome.queued) {
        return res.status(400).json({ error: outcome.reason || 'Could not queue generation' });
      }
      res.json({ success: true, jobId: outcome.jobId, status: outcome.status });
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

  router.post('/worker/upload', requireAiWorker, workerUpload.single('file'), async (req, res) => {
    try {
      if (!storageStore) {
        return res.status(503).json({ error: 'Storage not configured' });
      }
      if (!req.file) return res.status(400).json({ error: 'missing file' });
      const ownerUserId = req.body?.userId ?? req.body?.user_id ?? null;
      const asset = await storageStore.uploadPublicAsset({
        ownerUserId,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      });
      res.json({
        filename: asset.filename,
        url: asset.url,
        mime: asset.mimeType,
      });
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

  router.post('/worker/jobs/:id/progress', requireAiWorker, async (req, res) => {
    try {
      const jobRow = await jobStore.getJobById(req.params.id);
      if (!jobRow) return res.status(404).json({ error: 'Job not found' });
      if (jobRow.status !== 'claimed') {
        return res.status(409).json({ error: 'Job not in progress' });
      }
      if (!jobRow.profile_id) {
        return res.status(400).json({ error: 'Job has no profile_id' });
      }

      const profileSummary = req.body?.profileSummary ?? req.body?.profile_summary ?? '';
      const posts = req.body?.posts ?? [];
      const generationPlan = req.body?.generationPlan ?? req.body?.generation_plan ?? null;

      if (Array.isArray(generationPlan) && generationPlan.length > 0) {
        await jobStore.patchRequestPayload(jobRow.id, { generationPlan });
      }

      if (String(profileSummary).trim()) {
        await profileStore.updateProfileSummary({
          profileId: jobRow.profile_id,
          userId: jobRow.user_id,
          profileSummary,
        });
      }

      if (Array.isArray(posts) && posts.length > 0) {
        await profileStore.appendPosts({
          profileId: jobRow.profile_id,
          userId: jobRow.user_id,
          posts,
          source: 'generated',
        });
      }

      res.json({ success: true });
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

      const isPostsFamily = jobType === 'posts' || jobType === 'posts-single';
      const job = await jobStore.completeJob({
        jobId: req.params.id,
        posts: isPostsFamily ? posts : undefined,
        result: isPostsFamily ? posts : result,
      });

      if (isPostsFamily || jobType === 'bio') {
        if (profileSummary) {
          await profileStore.updateProfileSummary({
            profileId: job.profile_id,
            userId: job.user_id,
            profileSummary,
          });
        }
      }

      if (isPostsFamily && Array.isArray(posts) && posts.length > 0 && !req.body?.finalizeOnly) {
        await profileStore.appendPosts({
          profileId: job.profile_id,
          userId: job.user_id,
          posts,
          source: 'generated',
        });
      }

      if (jobType === 'blurbs') {
        const blurbs = result?.blurbs ?? null;
        if (blurbs && job.profile_id) {
          await profileStore.savePersonaBlurbs({ profileId: job.profile_id, blurbs });
        }
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
