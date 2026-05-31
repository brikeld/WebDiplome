import express from 'express';
import {
  getHarvestStatus,
  requestHarvest,
  markHarvestRunning,
  pushHarvestProgress,
  completeHarvest,
  failHarvest,
  ackHarvest,
} from '../lib/harvestSession.js';

function readProfileSlug(req) {
  return String(
    req.body?.profileSlug
    ?? req.body?.profile_slug
    ?? req.query?.profileSlug
    ?? req.query?.profile_slug
    ?? '',
  ).trim();
}

/** Remote harvest orchestration (web UI ↔ Electron collector). Per profile slug. */
export function createHarvestRoutes() {
  const router = express.Router();

  router.post('/harvest/request', (req, res) => {
    const profileSlug = readProfileSlug(req);
    const scoresBefore = req.body?.scoresBefore ?? req.body?.scores_before ?? null;
    const dynamicOnly = req.body?.dynamicOnly ?? req.body?.dynamic_only ?? false;
    const result = requestHarvest(scoresBefore, { dynamicOnly, profileSlug });
    if (!result.ok) return res.status(409).json(result);
    res.json({ success: true, profileSlug, ...getHarvestStatus(profileSlug) });
  });

  router.get('/harvest/status', (req, res) => {
    const profileSlug = readProfileSlug(req);
    if (!profileSlug) {
      return res.status(400).json({ error: 'profileSlug query parameter required' });
    }
    res.json({ profileSlug, ...getHarvestStatus(profileSlug) });
  });

  router.post('/harvest/running', (req, res) => {
    const profileSlug = readProfileSlug(req);
    const result = markHarvestRunning(profileSlug);
    if (!result.ok) return res.status(409).json(result);
    res.json({ success: true, profileSlug, ...getHarvestStatus(profileSlug) });
  });

  router.post('/harvest/progress', (req, res) => {
    const profileSlug = readProfileSlug(req);
    pushHarvestProgress(profileSlug, req.body ?? {});
    res.json({ success: true, profileSlug, ...getHarvestStatus(profileSlug) });
  });

  router.post('/harvest/complete', (req, res) => {
    const profileSlug = readProfileSlug(req);
    const scoresAfter = req.body?.scoresAfter ?? req.body?.scores_after ?? null;
    completeHarvest(profileSlug, scoresAfter);
    res.json({ success: true, profileSlug, ...getHarvestStatus(profileSlug) });
  });

  router.post('/harvest/error', (req, res) => {
    const profileSlug = readProfileSlug(req);
    failHarvest(profileSlug, req.body?.error || req.body?.message || 'Harvest failed');
    res.json({ success: true, profileSlug, ...getHarvestStatus(profileSlug) });
  });

  router.post('/harvest/ack', (req, res) => {
    const profileSlug = readProfileSlug(req);
    ackHarvest(profileSlug);
    res.json({ success: true, profileSlug, ...getHarvestStatus(profileSlug) });
  });

  return router;
}
