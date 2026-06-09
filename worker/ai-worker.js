import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import {
  generatePersonaPosts,
  generateSinglePersonaPost,
  generateUserSummary,
  preparePersonaPostSlotPlan,
} from '../server/lib/personaPostGenerator.js';
import { countAiGeneratedPosts } from '../server/lib/generationQueue.js';
import { generateCommentSuggestions } from '../server/lib/commentSuggestions.js';
import { generatePersonaBlurbs } from '../server/lib/personaBlurbs.js';
import { loadPrompts } from '../server/lib/prompts.js';
import { buildLmUserPayload } from '../server/lib/compactHarvestData.js';
import {
  stampPostForRevealSlot,
  stampPostsForRevealSlots,
} from '../server/lib/generationRevealOrder.js';
import {
  nextAssetPersona,
  pickRecencyFirstUnusedAssetCandidate,
} from '../server/lib/pickGenerationAsset.js';
import {
  extensionFromAssetCandidate,
  GENERATION_IMAGE_EXTS,
  isVisualGenerationAsset,
} from '../server/lib/generationAssetTypes.js';
import { extractDocText } from '../server/lib/docText.js';
import { isCompletePublicStorageObjectUrl } from '../src/lib/uploadPublicUrl.js';
import { ensureLmModelLoaded } from '../server/lib/lmStudioLoad.js';

const API = String(process.env.WEBDIPLOME_API_ORIGIN || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = String(process.env.AI_WORKER_TOKEN || '');
const WORKER_NAME = String(process.env.AI_WORKER_NAME || 'ai-pc');
const LM_STUDIO_BASE_URL = String(process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');
const LM_STUDIO_MODEL = String(process.env.LM_STUDIO_MODEL || 'google/gemma-4-e4b');
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

async function reportJobProgress(jobId, body) {
  if (!jobId) return false;
  try {
    await fetchJson(`${API}/api/worker/jobs/${jobId}/progress`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    return true;
  } catch (err) {
    console.warn(`[worker] progress ${jobId} failed:`, err.message);
    return false;
  }
}

async function fetchAssetAsAssignment(assetCandidate, targetPersona) {
  if (!assetCandidate?.url || !isVisualGenerationAsset(assetCandidate)) return null;
  const assetUrl = assetCandidate.url.startsWith('http')
    ? assetCandidate.url
    : `${API}${assetCandidate.url.startsWith('/') ? '' : '/'}${assetCandidate.url}`;
  const res = await fetch(assetUrl);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = assetCandidate.mime || res.headers.get('content-type') || 'image/jpeg';
  const filename = assetCandidate.filename || path.basename(assetUrl.split('?')[0]) || 'asset';
  const ext = extensionFromAssetCandidate(assetCandidate) || path.extname(filename).toLowerCase();

  if (ext === '.pdf' || String(mime).toLowerCase() === 'application/pdf') {
    const text = await extractDocText(buf, '.pdf');
    if (!text) return null;
    return {
      persona: targetPersona || 'productivite',
      asset: {
        kind: 'document',
        text,
        mime: 'application/pdf',
        filename,
        url: assetUrl,
      },
    };
  }

  if (String(mime).startsWith('image/') || GENERATION_IMAGE_EXTS.has(ext)) {
    return {
      persona: targetPersona || 'popularite',
      asset: {
        kind: 'image',
        base64: buf.toString('base64'),
        mime,
        filename,
        url: assetUrl,
      },
    };
  }

  return null;
}

function resolveDataJson(payload) {
  return payload.dataJson || payload.data_json || {};
}

function buildUserPayload(user, dataJson) {
  return buildLmUserPayload(user, dataJson);
}

async function uploadBufferToHostedApi(buffer, filename, mimeType, ownerUserId) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename);
  if (ownerUserId) form.append('userId', String(ownerUserId));
  const res = await fetch(`${API}/api/worker/upload`, {
    method: 'POST',
    headers: { 'x-ai-worker-token': TOKEN },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
  const url = json.url || null;
  if (!url) throw new Error('worker upload missing url');
  return {
    url,
    filename: json.filename || filename,
    mime: json.mime || mimeType,
  };
}

async function rewritePostAssetUrls(posts, ownerUserId) {
  const out = [];
  for (const post of posts) {
    const asset = post?.attachedAsset;
    if (!asset || typeof asset !== 'object') {
      out.push(post);
      continue;
    }

    const currentUrl = asset.url ? String(asset.url) : '';
    if (currentUrl && isCompletePublicStorageObjectUrl(currentUrl)) {
      const objectName = currentUrl.split('/').pop()?.split('?')[0];
      out.push(objectName && objectName !== asset.filename
        ? { ...post, attachedAsset: { ...asset, url: currentUrl, filename: objectName } }
        : post);
      continue;
    }

    const filename = asset.filename || (asset.url ? path.basename(String(asset.url)) : null);
    const mime = asset.mime || 'image/png';
    let hosted = null;

    if (filename) {
      const localPath = path.join(CHART_UPLOAD_DIR, filename);
      try {
        await fs.access(localPath);
        const buf = await fs.readFile(localPath);
        hosted = await uploadBufferToHostedApi(buf, filename, mime, ownerUserId);
      } catch {
        /* not a local chart file */
      }
    }

    if (!hosted && asset.url) {
      const rel = asset.url.startsWith('http')
        ? asset.url
        : `${API}${asset.url.startsWith('/') ? '' : '/'}${asset.url}`;
      try {
        const res = await fetch(rel);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          hosted = await uploadBufferToHostedApi(
            buf,
            filename || path.basename(rel.split('?')[0]) || 'asset.bin',
            res.headers.get('content-type') || mime,
            ownerUserId,
          );
        }
      } catch {
        /* ignore */
      }
    }

    out.push(hosted
      ? {
        ...post,
        attachedAsset: {
          ...asset,
          url: hosted.url,
          filename: hosted.filename || asset.filename,
          mime: hosted.mime || asset.mime,
        },
      }
      : post);
  }
  return out;
}

async function processPostsJob(payload, jobId, ownerUserId) {
  const profile = payload.profile || {};
  const dataJson = resolveDataJson(payload);
  const user = payload.user || {};
  const existingPosts = Array.isArray(payload.existingPosts) ? payload.existingPosts : [];
  const isFirstGeneration = existingPosts.length === 0;
  const userPayload = buildUserPayload(user, dataJson);
  const prompts = await loadPrompts(process.cwd());
  const assetCandidate = pickRecencyFirstUnusedAssetCandidate(
    Array.isArray(payload.assetCandidates) ? payload.assetCandidates : [],
    existingPosts,
  );
  const assetAssignment = await fetchAssetAsAssignment(
    assetCandidate,
    payload.assetPersona || nextAssetPersona(existingPosts),
  );
  if (!assetAssignment) {
    const poolSize = Array.isArray(payload.assetCandidates) ? payload.assetCandidates.length : 0;
    console.warn(
      `[worker] asset slot skipped: pool=${poolSize} candidate=${assetCandidate?.filename ?? 'none'}`,
    );
  }

  await fs.mkdir(CHART_UPLOAD_DIR, { recursive: true });

  const generationPlan = await preparePersonaPostSlotPlan({
    userPayload,
    assetAssignment,
    prompts,
    dataJson,
    profile,
    existingPosts,
    chartUploadDir: CHART_UPLOAD_DIR,
    skipLeaderboard: isFirstGeneration,
  });
  await reportJobProgress(jobId, { generationPlan });

  const existingBio = String(profile.profileSummary || profile.userDescription || '').trim();
  let profileSummary = existingBio;
  let progressPostsSaved = 0;

  if (!existingBio) {
    profileSummary = await generateUserSummary({
      baseUrl: LM_STUDIO_BASE_URL,
      model: LM_STUDIO_MODEL,
      userPayload,
      timeoutMs: TIMEOUT_MS,
      retries: RETRIES,
      prompts,
    });
    const bio = String(profileSummary || '').trim();
    if (bio) {
      await reportJobProgress(jobId, { profileSummary: bio });
    }
  }

  const revealBaseTimeMs = Date.now();
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
    skipLeaderboard: isFirstGeneration,
    preferMetadataFallback: true,
    onEachPost: async (post, meta) => {
      if (!post?.content) return;
      const slotIndex = meta && typeof meta.slotIndex === 'number' ? meta.slotIndex : 0;
      stampPostForRevealSlot(post, slotIndex, revealBaseTimeMs);
      const [rewritten] = await rewritePostAssetUrls([post], ownerUserId);
      if (!rewritten) return;
      if (await reportJobProgress(jobId, { posts: [rewritten] })) {
        progressPostsSaved += 1;
      }
    },
  });

  stampPostsForRevealSlots(slotResults, revealBaseTimeMs);
  const posts = await rewritePostAssetUrls(slotResults.filter(Boolean), ownerUserId);
  const allPostsSavedViaProgress = posts.length > 0 && progressPostsSaved >= posts.length;

  return {
    posts,
    profileSummary: String(profileSummary || '').trim(),
    finalizeOnly: allPostsSavedViaProgress,
  };
}

async function processPostsSingleJob(payload, jobId, ownerUserId) {
  const profile = payload.profile || {};
  const dataJson = resolveDataJson(payload);
  const user = payload.user || {};
  const existingPosts = Array.isArray(payload.existingPosts) ? payload.existingPosts : [];
  const isFirstGeneration = existingPosts.length === 0;
  const userPayload = buildUserPayload(user, dataJson);
  const prompts = await loadPrompts(process.cwd());
  const assetCandidate = pickRecencyFirstUnusedAssetCandidate(
    Array.isArray(payload.assetCandidates) ? payload.assetCandidates : [],
    existingPosts,
  );
  const assetAssignment = await fetchAssetAsAssignment(
    assetCandidate,
    payload.assetPersona || nextAssetPersona(existingPosts),
  );

  await fs.mkdir(CHART_UPLOAD_DIR, { recursive: true });

  const slotIndex = countAiGeneratedPosts(existingPosts) % 3;
  const revealBaseTimeMs = Date.now();

  const post = await generateSinglePersonaPost({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    userPayload,
    timeoutMs: TIMEOUT_MS,
    retries: RETRIES,
    assetAssignment,
    prompts,
    dataJson,
    profile,
    existingPosts,
    chartUploadDir: CHART_UPLOAD_DIR,
    skipLeaderboard: isFirstGeneration,
    preferMetadataFallback: true,
  });

  if (!post?.content) {
    return { posts: [], finalizeOnly: true };
  }

  stampPostForRevealSlot(post, slotIndex, revealBaseTimeMs);
  const [rewritten] = await rewritePostAssetUrls([post], ownerUserId);
  if (!rewritten) {
    return { posts: [], finalizeOnly: true };
  }

  return { posts: [rewritten], finalizeOnly: false };
}

async function processBioJob(payload, jobId) {
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
  const bio = String(profileSummary || '').trim();
  if (bio) {
    await reportJobProgress(jobId, { profileSummary: bio });
  }
  return {
    profileSummary: bio,
    result: { profileSummary: bio },
  };
}

async function processCommentsJob(payload) {
  const suggestions = await generateCommentSuggestions({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    profile: payload.profile || {},
    post: payload.post || {},
    electronData: payload.dataJson ?? null,
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
    electronData: payload.dataJson ?? null,
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

  switch (jobType) {
    case 'bio':
      return processBioJob(payload, job.id);
    case 'comments':
      return processCommentsJob(payload);
    case 'blurbs':
      return processBlurbsJob(payload);
    case 'posts-single':
      return processPostsSingleJob(payload, job.id, job.user_id ?? null);
    case 'posts':
    default:
      return processPostsJob(payload, job.id, job.user_id ?? null);
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
    if (jobType === 'posts' || jobType === 'posts-single') {
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
