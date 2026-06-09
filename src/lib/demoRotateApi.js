import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { pollGenerationJob } from '@/lib/aiJobClient.js';
import { fetchWithHostedAuth } from '@/lib/hostedAccount.js';

const API_ORIGIN = resolveApiOrigin();

export async function queueDemoSinglePost(profileSlug) {
  const slug = String(profileSlug || '').trim();
  if (!slug) throw new Error('Profile slug required');

  const res = await fetchWithHostedAuth(`${API_ORIGIN}/api/debug/demo-rotate/single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileSlug: slug }),
  });

  const body = await res.json().catch(async () => {
    const errText = await res.text().catch(() => '');
    return { error: errText.slice(0, 200) || `Demo rotate failed (${res.status})` };
  });

  if (!res.ok) {
    return {
      queued: false,
      reason: body?.reason ?? body?.error ?? 'request_failed',
      alreadyQueued: body?.alreadyQueued ?? false,
      jobId: body?.jobId ?? null,
      status: body?.status ?? null,
      generatingPersona: body?.generatingPersona ?? null,
    };
  }

  return body;
}

export async function runDemoSinglePostAndWait(profileSlug, pollOptions) {
  const created = await queueDemoSinglePost(profileSlug);
  if (created?.alreadyQueued && created?.jobId) {
    return pollGenerationJob(created.jobId, pollOptions);
  }
  if (!created?.jobId) {
    if (created?.reason === 'no_harvest_data') {
      throw new Error('No stored harvest data for this profile');
    }
    throw new Error(created?.reason || 'Could not queue demo post');
  }
  return pollGenerationJob(created.jobId, pollOptions);
}
