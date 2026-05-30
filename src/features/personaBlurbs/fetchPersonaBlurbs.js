import { isHostedApiOrigin, slimProfileForAiRequest, submitQueuedAiEndpoint } from '@/lib/aiJobClient.js';
import { resolveGenerateApiOrigin } from '@/lib/apiOrigin.js';

const GENERATE_API_ORIGIN = resolveGenerateApiOrigin();

/** @typedef {{ productivity?: string, security?: string, social?: string }} PersonaBlurbsUi */

function mapBlurbs(raw) {
  return {
    productivity: String(raw.productivite ?? raw.productivity ?? '').trim(),
    security: String(raw.securite ?? raw.security ?? '').trim(),
    social: String(raw.popularite ?? raw.social ?? raw.popularity ?? '').trim(),
  };
}

/**
 * @param {{ productivity?: number, security?: number, social?: number }} scores
 * @returns {Promise<PersonaBlurbsUi>}
 */
export async function fetchPersonaBlurbs(scores, profile) {
  const body = {
    scores: {
      productivity: scores?.productivity,
      security: scores?.security,
      social: scores?.social ?? scores?.popularity,
    },
  };
  const slimProfile = slimProfileForAiRequest(profile);
  if (slimProfile) body.profile = slimProfile;

  if (isHostedApiOrigin()) {
    const result = await submitQueuedAiEndpoint('/api/persona-blurbs/generate', body);
    const raw = result?.blurbs && typeof result.blurbs === 'object' ? result.blurbs : result;
    return mapBlurbs(raw ?? {});
  }

  const res = await fetch(`${GENERATE_API_ORIGIN}/api/persona-blurbs/generate`, {
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
  const raw = data?.blurbs && typeof data.blurbs === 'object' ? data.blurbs : {};
  return mapBlurbs(raw);
}
