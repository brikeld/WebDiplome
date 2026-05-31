import express from 'express';
import multer from 'multer';
import { requireHostedUser } from '../lib/auth.js';
import { recordHostedAccountDeletion } from '../lib/hostedAccountDeletion.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export function createPublicDemoRoutes({ supabaseService, profileStore, storageStore, buildLeaderboards }) {
  const router = express.Router();
  const requireUser = requireHostedUser(supabaseService);

  router.get('/profiles', async (_req, res) => {
    try {
      res.json(await profileStore.listProfiles());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/profiles/:slug', async (req, res) => {
    try {
      const profile = await profileStore.getProfileBySlug(req.params.slug);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      res.json(profile);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/profile/me', requireUser, async (req, res) => {
    try {
      const profile = await profileStore.getProfileByUserId(req.authUser.id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      res.json({ success: true, profile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/profile/sync', requireUser, async (req, res) => {
    try {
      const profile = await profileStore.upsertProfileSync({
        userId: req.authUser.id,
        payload: req.body ?? {},
        replacePosts: req.body?.replacePersonaPosts === true,
      });
      res.json({ success: true, profile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/leaderboards', async (_req, res) => {
    try {
      const profiles = await profileStore.listProfiles();
      res.json({ success: true, leaderboards: buildLeaderboards(profiles) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/comments', requireUser, async (req, res) => {
    try {
      const authorProfile = await profileStore.getProfileRowBySlug(String(req.body?.authorProfileSlug || ''));
      if (!authorProfile || authorProfile.user_id !== req.authUser.id) {
        return res.status(403).json({ error: 'Author profile owner required' });
      }
      const content = String(req.body?.content || '').trim();
      if (!content) return res.status(400).json({ error: 'content required' });
      const comment = await profileStore.addComment({
        postId: req.body?.postId,
        authorProfileId: authorProfile.id,
        persona: req.body?.persona ?? null,
        content,
      });
      res.json({ success: true, comment });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/upload', requireUser, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'missing file' });
      const asset = await storageStore.uploadPublicAsset({
        ownerUserId: req.authUser.id,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      });
      res.json(asset);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/app-releases/latest', async (req, res) => {
    try {
      const platform = String(req.query.platform || 'mac');
      const release = await profileStore.latestRelease(platform);
      if (!release) return res.status(404).json({ error: 'No release found' });
      res.json({
        platform: release.platform,
        version: release.version,
        downloadUrl: release.download_url,
        sizeLabel: release.size_label,
        createdAt: release.created_at,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/account', requireUser, async (req, res) => {
    try {
      const result = await profileStore.deleteAccountForUser(req.authUser.id);
      if (result?.deleted && result?.slug) {
        recordHostedAccountDeletion(result.slug);
      }
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
