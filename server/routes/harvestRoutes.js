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

/** Remote harvest orchestration (web UI ↔ Electron). Must run in hosted + local mode. */
export function createHarvestRoutes() {
  const router = express.Router();

  router.post('/harvest/request', (req, res) => {
    const scoresBefore = req.body?.scoresBefore ?? req.body?.scores_before ?? null;
    const dynamicOnly = req.body?.dynamicOnly ?? req.body?.dynamic_only ?? false;
    const result = requestHarvest(scoresBefore, { dynamicOnly });
    if (!result.ok) return res.status(409).json(result);
    res.json({ success: true, ...getHarvestStatus() });
  });

  router.get('/harvest/status', (_req, res) => {
    res.json(getHarvestStatus());
  });

  router.post('/harvest/running', (_req, res) => {
    const result = markHarvestRunning();
    if (!result.ok) return res.status(409).json(result);
    res.json({ success: true, ...getHarvestStatus() });
  });

  router.post('/harvest/progress', (req, res) => {
    pushHarvestProgress(req.body ?? {});
    res.json({ success: true, ...getHarvestStatus() });
  });

  router.post('/harvest/complete', (req, res) => {
    const scoresAfter = req.body?.scoresAfter ?? req.body?.scores_after ?? null;
    completeHarvest(scoresAfter);
    res.json({ success: true, ...getHarvestStatus() });
  });

  router.post('/harvest/error', (req, res) => {
    failHarvest(req.body?.error || req.body?.message || 'Harvest failed');
    res.json({ success: true, ...getHarvestStatus() });
  });

  router.post('/harvest/ack', (_req, res) => {
    ackHarvest();
    res.json({ success: true, ...getHarvestStatus() });
  });

  return router;
}
