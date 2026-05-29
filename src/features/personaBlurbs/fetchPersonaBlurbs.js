const GENERATE_API_ORIGIN =
  (import.meta?.env?.VITE_GENERATE_API_ORIGIN && String(import.meta.env.VITE_GENERATE_API_ORIGIN)) ||
  'http://localhost:3010';

/** @typedef {{ productivity?: string, security?: string, social?: string }} PersonaBlurbsUi */

/**
 * @param {{ productivity?: number, security?: number, social?: number }} scores
 * @returns {Promise<PersonaBlurbsUi>}
 */
export async function fetchPersonaBlurbs(scores) {
  const res = await fetch(`${GENERATE_API_ORIGIN}/api/persona-blurbs/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scores: {
        productivity: scores?.productivity,
        security: scores?.security,
        social: scores?.social ?? scores?.popularity,
      },
    }),
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

  return {
    productivity: String(raw.productivite ?? raw.productivity ?? '').trim(),
    security: String(raw.securite ?? raw.security ?? '').trim(),
    social: String(raw.popularite ?? raw.social ?? raw.popularity ?? '').trim(),
  };
}
