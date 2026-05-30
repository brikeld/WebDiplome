import { resolveApiOrigin } from './apiOrigin.js';

const API_ORIGIN = resolveApiOrigin();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isHostedApiOrigin() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

/** Strip wallpaper/personaPosts before sending profile to hosted AI job queue. */
export function slimProfileForAiRequest(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const { wallpaperBase64, wallpaper_base64, personaPosts, persona_posts, ...rest } = profile;
  return rest;
}

export function profileSlugFromProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const slug = profile.slug ?? profile.id;
  return slug ? String(slug).trim() : null;
}

export async function pollGenerationJob(jobId, {
  pollMs = 2000,
  timeoutMs = 180000,
} = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${API_ORIGIN}/api/generation-jobs/${encodeURIComponent(jobId)}`);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(errText.slice(0, 200) || `Job poll failed (${res.status})`);
    }
    const { job } = await res.json();
    if (!job) throw new Error('Job not found');
    if (job.status === 'complete') return job;
    if (job.status === 'failed') throw new Error(job.error || 'AI job failed');
    await sleep(pollMs);
  }
  throw new Error('AI job timed out — is your AI PC worker running?');
}

export async function submitPublicAiJob(jobType, payload, pollOptions) {
  const res = await fetch(`${API_ORIGIN}/api/generation-jobs/public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobType, payload }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText.slice(0, 200) || `Job submit failed (${res.status})`);
  }
  const created = await res.json();
  if (!created?.jobId) throw new Error('No job id returned');
  return pollGenerationJob(created.jobId, pollOptions);
}

export async function submitQueuedAiEndpoint(path, body, pollOptions) {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText.slice(0, 200) || `Request failed (${res.status})`);
  }
  const created = await res.json();
  if (created?.jobId) {
    const job = await pollGenerationJob(created.jobId, pollOptions);
    return job.result ?? job.posts ?? job;
  }
  return created;
}
