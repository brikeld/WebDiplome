import { harvestPayloadHasContent } from './generationQueue.js';
import { synthesizeHarvestDataFromProfile } from './synthesizeDemoHarvestData.js';

function harvestFromRawProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const data =
    raw.lastHarvestDataJson
    ?? raw.dataJson
    ?? raw.data_json
    ?? null;
  return harvestPayloadHasContent(data) ? data : null;
}

/**
 * Resolve LM harvest payload for a profile: stored fields → job history → synthesized fallback.
 */
export async function resolveProfileHarvestDataJson(
  rawProfile,
  profileId,
  jobStore,
  { profileRow = null, apiProfile = null, allowSynthesize = false } = {},
) {
  const fromProfile = harvestFromRawProfile(rawProfile);
  if (fromProfile) return fromProfile;
  if (jobStore && profileId) {
    if (typeof jobStore.findLatestHarvestDataJson === 'function') {
      const fromJobs = await jobStore.findLatestHarvestDataJson(profileId);
      if (fromJobs) return fromJobs;
    }

    for (const jobType of ['posts-single', 'posts', 'bio', 'blurbs']) {
      const latest = await jobStore.findLatestJobPayload(profileId, jobType);
      const payload = latest?.request_payload;
      if (!payload || typeof payload !== 'object') continue;
      const data = payload.dataJson ?? payload.data_json ?? null;
      if (harvestPayloadHasContent(data)) return data;
    }
  }

  if (allowSynthesize) {
    const synthesized = synthesizeHarvestDataFromProfile(profileRow, apiProfile);
    if (harvestPayloadHasContent(synthesized)) return synthesized;
  }

  return null;
}
