import { isHostedApiOrigin, pollGenerationJob, profileSlugFromProfile } from '@/lib/aiJobClient.js';
import { resolveApiOrigin, resolveGenerateApiOrigin } from '@/lib/apiOrigin.js';

const GENERATE_API_ORIGIN = resolveGenerateApiOrigin();
const API_ORIGIN = resolveApiOrigin();

/** @typedef {{ productivity?: string, security?: string, social?: string }} PersonaBlurbsUi */

function mapBlurbs(raw) {
  return {
    productivity: String(raw.productivite ?? raw.productivity ?? '').trim(),
    security: String(raw.securite ?? raw.security ?? '').trim(),
    social: String(raw.popularite ?? raw.social ?? raw.popularity ?? '').trim(),
  };
}

function hasAllBlurbs(blurbs) {
  return blurbs?.productivity && blurbs?.security && blurbs?.social;
}

/**
 * Fetch fixed persona blurbs for the profile page subject (not the viewer).
 * @param {{ productivity?: number, security?: number, social?: number }} scores
 * @param {object} subjectProfile — profile being viewed
 */
export async function fetchPersonaBlurbs(scores, subjectProfile, { subjectProfileSlug } = {}) {
  const slug = subjectProfileSlug || profileSlugFromProfile(subjectProfile);
  const body = {
    profileSlug: slug,
    scores: {
      productivity: scores?.productivity,
      security: scores?.security,
      social: scores?.social ?? scores?.popularity,
    },
  };

  const endpoint = isHostedApiOrigin()
    ? `${API_ORIGIN}/api/persona-blurbs/generate`
    : `${GENERATE_API_ORIGIN}/api/persona-blurbs/generate`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let msg = `Persona blurbs failed (${res.status})`;
    try {
      const j = JSON.parse(errText);
      if (j?.error) msg = j.error;
    } catch {
      if (errText) msg = errText.slice(0, 200);
    }
    throw new Error(msg);
  }

  const data = await res.json();
  if (data?.cached && hasAllBlurbs(mapBlurbs(data?.blurbs ?? {}))) {
    return mapBlurbs(data.blurbs);
  }
  if (data?.jobId && isHostedApiOrigin()) {
    const job = await pollGenerationJob(data.jobId);
    const raw = job?.result?.blurbs ?? job?.result ?? {};
    return mapBlurbs(raw);
  }
  const raw = data?.blurbs && typeof data.blurbs === 'object' ? data.blurbs : {};
  return mapBlurbs(raw);
}
