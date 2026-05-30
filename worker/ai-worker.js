import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { generatePersonaPosts, generateUserSummary } from '../server/lib/personaPostGenerator.js';
import { generateCommentSuggestions } from '../server/lib/commentSuggestions.js';
import { generatePersonaBlurbs } from '../server/lib/personaBlurbs.js';
import { loadPrompts } from '../server/lib/prompts.js';
import { ensureLmModelLoaded } from '../server/lib/lmStudioLoad.js';

const API = String(process.env.WEBDIPLOME_API_ORIGIN || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = String(process.env.AI_WORKER_TOKEN || '');
const WORKER_NAME = String(process.env.AI_WORKER_NAME || 'ai-pc');
const LM_STUDIO_BASE_URL = String(process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');
const LM_STUDIO_MODEL = String(process.env.LM_STUDIO_MODEL || 'google/gemma-4-e2b');
const TIMEOUT_MS = parseInt(process.env.LM_STUDIO_TIMEOUT_MS || '180000', 10);
const RETRIES = parseInt(process.env.LM_STUDIO_RETRIES || '1', 10);
const POLL_MS = parseInt(process.env.AI_WORKER_POLL_MS || '5000', 10);
const CHART_UPLOAD_DIR = path.join(os.tmpdir(), 'webdiplome-worker-charts');

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
  const assetUrl = assetCandidate.url.startsWith('http')
    ? assetCandidate.url
    : `${API}${assetCandidate.url}`;
  const res = await fetch(assetUrl);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = assetCandidate.mime || res.headers.get('content-type') || 'image/jpeg';
  if (String(mime).startsWith('image/')) {
    return {
      persona: targetPersona || 'popularite',
      asset: {
        kind: 'image',
        base64: buf.toString('base64'),
        mime,
        filename: assetCandidate.filename || 'asset',
      },
    };
  }
  return {
    persona: targetPersona || 'productivite',
    asset: {
      kind: 'document',
      text: buf.toString('utf8'),
      mime,
      filename: assetCandidate.filename || 'document',
    },
  };
}

function resolveDataJson(payload) {
  return payload.dataJson || payload.data_json || {};
}

function buildUserPayload(user, dataJson) {
  const u = user && typeof user === 'object' ? user : {};
  if (dataJson && typeof dataJson === 'object' && Object.keys(dataJson).length > 0) {
    return JSON.stringify({ user: u, profile: dataJson });
  }
  return JSON.stringify({ user: u });
}

async function uploadFileToHostedApi(localPath, filename) {
  const buf = await fs.readFile(localPath);
  const form = new FormData();
  form.append('file', new Blob([buf]), filename);
  const res = await fetch(`${API}/api/upload`, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
  const url = json.url || `/uploads/${json.filename || filename}`;
  return url.startsWith('http') ? url : `${API}${url}`;
}

async function rewritePostAssetUrls(posts) {
  const out = [];
  for (const post of posts) {
    const asset = post?.attachedAsset;
    if (!asset || typeof asset !== 'object') {
      out.push(post);
      continue;
    }
    const rel = asset.url || (asset.filename ? `/uploads/${asset.filename}` : null);
    if (!rel || rel.startsWith('http')) {
      out.push(post);
      continue;
    }
    const localPath = path.join(CHART_UPLOAD_DIR, asset.filename || path.basename(rel));
    try {
      await fs.access(localPath);
      const hostedUrl = await uploadFileToHostedApi(localPath, asset.filename || path.basename(rel));
      out.push({
        ...post,
        attachedAsset: { ...asset, url: hostedUrl },
      });
    } catch {
      out.push(post);
    }
  }
  return out;
}

async function processPostsJob(payload) {
  const profile = payload.profile || {};
  const dataJson = resolveDataJson(payload);
  const user = payload.user || {};
  const existingPosts = Array.isArray(payload.existingPosts) ? payload.existingPosts : [];
  const userPayload = buildUserPayload(user, dataJson);
  const prompts = await loadPrompts(process.cwd());
  const assetAssignment = await fetchAssetAsAssignment(
    Array.isArray(payload.assetCandidates) ? payload.assetCandidates[0] : null,
    payload.assetPersona || 'popularite',
  );

  await fs.mkdir(CHART_UPLOAD_DIR, { recursive: true });

  const existingBio = String(profile.profileSummary || profile.userDescription || '').trim();
  let profileSummary = existingBio;
  if (!existingBio) {
    profileSummary = await generateUserSummary({
      baseUrl: LM_STUDIO_BASE_URL,
      model: LM_STUDIO_MODEL,
      userPayload,
      timeoutMs: TIMEOUT_MS,
      retries: RETRIES,
      prompts,
    });
  }

  const slotResults = await generatePersonaPosts({
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
    chartUploadDir: CHART_UPLOAD_DIR,
  });

  const posts = await rewritePostAssetUrls(slotResults.filter(Boolean));

  return {
    posts,
    profileSummary: String(profileSummary || '').trim(),
  };
}

async function processBioJob(payload) {
  const dataJson = resolveDataJson(payload);
  const user = payload.user || {};
  const userPayload = buildUserPayload(user, dataJson);
  const prompts = await loadPrompts(process.cwd());
  const profileSummary = await generateUserSummary({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    userPayload,
    timeoutMs: TIMEOUT_MS,
    retries: RETRIES,
    prompts,
  });
  return {
    profileSummary: String(profileSummary || '').trim(),
    result: { profileSummary: String(profileSummary || '').trim() },
  };
}

async function processCommentsJob(payload) {
  const suggestions = await generateCommentSuggestions({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    profile: payload.profile || {},
    post: payload.post || {},
    timeoutMs: TIMEOUT_MS,
    retries: RETRIES,
    allowedPersonas: payload.allowedPersonas ?? null,
  });
  return { result: { suggestions } };
}

async function processBlurbsJob(payload) {
  const blurbs = await generatePersonaBlurbs({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    profile: payload.profile || {},
    scores: payload.scores || {},
    timeoutMs: TIMEOUT_MS,
    retries: RETRIES,
  });
  return {
    result: {
      blurbs: {
        productivite: blurbs.productivite ?? '',
        securite: blurbs.securite ?? '',
        popularite: blurbs.popularite ?? '',
        productivity: blurbs.productivite ?? '',
        security: blurbs.securite ?? '',
        social: blurbs.popularite ?? '',
      },
    },
  };
}

async function processJob(job) {
  const payload = job.request_payload || {};
  const jobType = payload.jobType || 'posts';

  await ensureLmModelLoaded({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    timeoutMs: TIMEOUT_MS,
  });

  switch (jobType) {
    case 'bio':
      return processBioJob(payload);
    case 'comments':
      return processCommentsJob(payload);
    case 'blurbs':
      return processBlurbsJob(payload);
    case 'posts':
    default:
      return processPostsJob(payload);
  }
}

async function loop() {
  console.log(`[worker] started — API ${API} — LM ${LM_STUDIO_BASE_URL} — polling every ${POLL_MS / 1000}s`);
  try {
    await ensureLmModelLoaded({
      baseUrl: LM_STUDIO_BASE_URL,
      model: LM_STUDIO_MODEL,
      timeoutMs: TIMEOUT_MS,
    });
  } catch (err) {
    console.warn('[worker] initial LM Studio load failed (will retry per job):', err.message);
  }

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

  const jobType = job.request_payload?.jobType || 'posts';
  console.log(`[worker] claimed ${job.id} (${jobType})`);

  try {
    const outcome = await processJob(job);
    await fetchJson(`${API}/api/worker/jobs/${job.id}/complete`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(outcome),
    });
    if (jobType === 'posts') {
      console.log(`[worker] completed ${job.id} with ${outcome.posts?.length ?? 0} posts`);
    } else {
      console.log(`[worker] completed ${job.id} (${jobType})`);
    }
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

loop();
