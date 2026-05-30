import { generatePersonaPosts, generateUserSummary } from '../server/lib/personaPostGenerator.js';
import { loadPrompts } from '../server/lib/prompts.js';
import {
  buildLmUserPayload,
  compactHarvestDataForLm,
} from '../server/lib/compactHarvestData.js';
import {
  capDocumentText,
  prepareImageForLmVision,
} from '../server/lib/lmAssetPrep.js';

const API = String(process.env.WEBDIPLOME_API_ORIGIN || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = String(process.env.AI_WORKER_TOKEN || '');
const WORKER_NAME = String(process.env.AI_WORKER_NAME || 'ai-pc');
const LM_STUDIO_BASE_URL = String(process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');
const LM_STUDIO_MODEL = String(process.env.LM_STUDIO_MODEL || 'google/gemma-4-e2b');
const TIMEOUT_MS = parseInt(process.env.LM_STUDIO_TIMEOUT_MS || '180000', 10);
const RETRIES = parseInt(process.env.LM_STUDIO_RETRIES || '1', 10);
const POLL_MS = parseInt(process.env.AI_WORKER_POLL_MS || '5000', 10);

function headers() {
  return { 'Content-Type': 'application/json', 'x-ai-worker-token': TOKEN };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function fetchAssetAsAssignment(assetCandidate, targetPersona) {
  if (!assetCandidate?.url) return null;
  const res = await fetch(assetCandidate.url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = assetCandidate.mime || res.headers.get('content-type') || 'image/jpeg';
  if (String(mime).startsWith('image/')) {
    const prepared = await prepareImageForLmVision(buf);
    if (prepared) {
      return {
        persona: targetPersona || 'popularite',
        asset: {
          kind: 'image',
          base64: prepared.base64,
          mime: prepared.mime,
          filename: assetCandidate.filename || 'asset',
        },
      };
    }
    return {
      persona: targetPersona || 'popularite',
      asset: {
        kind: 'image',
        filename: assetCandidate.filename || 'asset',
        mime,
        textFallbackOnly: true,
      },
    };
  }
  const text = capDocumentText(buf.toString('utf8'));
  return {
    persona: targetPersona || 'productivite',
    asset: {
      kind: 'document',
      text,
      mime,
      filename: assetCandidate.filename || 'document',
    },
  };
}

async function processJob(job) {
  const payload = job.request_payload || {};
  const profile = payload.profile || {};
  const dataJson = compactHarvestDataForLm(payload.dataJson || payload.data_json || {});
  const user = payload.user || {};
  const existingPosts = Array.isArray(payload.existingPosts) ? payload.existingPosts : [];
  const userPayload = buildLmUserPayload(user, dataJson);
  const prompts = await loadPrompts(process.cwd());
  const assetAssignment = await fetchAssetAsAssignment(
    Array.isArray(payload.assetCandidates) ? payload.assetCandidates[0] : null,
    payload.assetPersona || 'popularite',
  );

  const profileSummary = profile.profileSummary || profile.userDescription || await generateUserSummary({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    userPayload,
    timeoutMs: TIMEOUT_MS,
    retries: RETRIES,
    prompts,
  });

  const posts = await generatePersonaPosts({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    userPayload,
    timeoutMs: TIMEOUT_MS,
    retries: RETRIES,
    assetAssignment,
    prompts,
    dataJson,
    profile: { ...profile, profileSummary, userDescription: profileSummary },
    existingPosts,
    chartUploadDir: null,
  });

  return {
    posts: posts.filter(Boolean),
    profileSummary: String(profileSummary || '').trim(),
  };
}

async function loop() {
  console.log(`[worker] started — API ${API} — polling every ${POLL_MS / 1000}s`);
  let idleTicks = 0;
  for (;;) {
    try {
      const hadJob = await tick();
      if (hadJob) idleTicks = 0;
      else {
        idleTicks += 1;
        if (idleTicks === 1 || idleTicks % 12 === 0) {
          console.log('[worker] waiting for generation jobs…');
        }
      }
    } catch (err) {
      console.error('[worker] tick failed:', err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

async function tick() {
  if (!TOKEN) throw new Error('AI_WORKER_TOKEN is required');
  const { job } = await fetchJson(`${API}/api/worker/jobs/next?worker=${encodeURIComponent(WORKER_NAME)}`, {
    headers: headers(),
  });
  if (!job) return false;

  try {
    const { posts, profileSummary } = await processJob(job);
    await fetchJson(`${API}/api/worker/jobs/${job.id}/complete`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ posts, profileSummary }),
    });
    console.log(`[worker] completed ${job.id} with ${posts.length} posts`);
  } catch (err) {
    await fetchJson(`${API}/api/worker/jobs/${job.id}/fail`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ error: err.message }),
    }).catch(() => {});
    console.error(`[worker] failed ${job.id}:`, err.message);
  }
  return true;
}

// loop() is started at the bottom of this file
loop();
