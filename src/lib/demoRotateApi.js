import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { pollGenerationJob } from '@/lib/aiJobClient.js';
import { hostedAuthHeaders } from '@/lib/hostedAccount.js';

const API_ORIGIN = resolveApiOrigin();

export async function queueDemoSinglePost(profileSlug) {
  const slug = String(profileSlug || '').trim();
  if (!slug) throw new Error('Profile slug required');

  const res = await fetch(`${API_ORIGIN}/api/debug/demo-rotate/single`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...hostedAuthHeaders(),
    },
    body: JSON.stringify({ profileSlug: slug }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText.slice(0, 200) || `Demo rotate failed (${res.status})`);
  }

  return res.json();
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
