/**
 * LM Studio–compatible persona post generation (OpenAI-style /v1/chat/completions).
 * Produces exactly 3 posts: productivite, securite, popularite.
 */

const PERSONAS = ['productivite', 'securite', 'popularite'];

function truncate(str, max) {
  if (str == null) return '';
  const s = String(str);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function buildPrompt(profile) {
  const first = profile?.firstname ?? profile?.firstName ?? '';
  const last = profile?.lastname ?? profile?.lastName ?? '';
  const machine = profile?.machineName ?? profile?.machine_name ?? '';
  const dominant = profile?.dominantPersona ?? profile?.dominant_persona ?? '';
  const bio = truncate(profile?.userDescription ?? profile?.user_description ?? '', 600);
  const summary = truncate(profile?.profileSummary ?? profile?.profile_summary ?? '', 900);

  return `Tu génères 3 courts messages de réseau social en première personne pour un sujet fictif « compliant ».

Contexte du profil (ne pas inventer de faits précis non listés ; rester plausible et générique) :
- Prénom / nom : ${first} ${last}
- Machine : ${machine}
- Persona dominant : ${dominant}
- Bio : ${bio || '—'}
- Synthèse activité : ${summary || '—'}

Contraintes pour CHAQUE message :
- persona EXACTEMENT l'une de : productivite | securite | popularite (une seule fois chacune)
- productivite : travail, organisation, concentration, dette technique légère
- securite : données, vie privée, surface d'exposition numérique, hygiène numérique
- popularite : social, réseaux, FOMO, notifications, relations en ligne
- content : français ou anglais mélangé OK ; ton conversationnel ; première personne ; sans hashtags ; 1–3 phrases ; maximum ~380 caractères
- sentiment : "positive" | "negative" ou null

Réponds UNIQUEMENT avec un JSON valide (aucun markdown, aucun texte avant/après) de cette forme exacte :
{"posts":[
  {"persona":"productivite","content":"...","sentiment":null},
  {"persona":"securite","content":"...","sentiment":null},
  {"persona":"popularite","content":"...","sentiment":null}
]}`;
}

function stripJsonFence(text) {
  const t = String(text).trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```\s*$/im.exec(t);
  if (fence) return fence[1].trim();
  return t;
}

function extractJsonObject(text) {
  const s = stripJsonFence(text);
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeSentiment(v) {
  if (v == null || v === '') return null;
  const x = String(v).toLowerCase();
  if (x === 'positive' || x === 'negative') return x;
  return null;
}

function validateAndStampPosts(rawPosts) {
  const list = rawPosts?.posts ?? rawPosts;
  if (!Array.isArray(list)) throw new Error('Model output: expected posts array');

  const byKey = new Map();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const persona = String(item.persona ?? '').toLowerCase();
    if (!PERSONAS.includes(persona)) continue;
    if (!byKey.has(persona)) byKey.set(persona, item);
  }
  if (byKey.size !== 3) throw new Error('Model output: need one post per persona');

  const base = Date.now();
  return PERSONAS.map((persona, i) => {
    const p = byKey.get(persona);
    const content = String(p.content ?? '').trim();
    if (!content) throw new Error(`Empty content for ${persona}`);
    return {
      persona,
      content,
      sentiment: normalizeSentiment(p.sentiment),
      createdAt: new Date(base + (3 - i)).toISOString(),
    };
  });
}

export async function generatePersonaPosts(profile) {
  const DEFAULT_LM_STUDIO_BASE_URL = 'http://127.0.0.1:1234';
  const DEFAULT_LM_STUDIO_MODEL = 'google/gemma-4-e4b';

  const rawBase = String(process.env.LM_STUDIO_BASE_URL || DEFAULT_LM_STUDIO_BASE_URL).replace(/\/$/, '');
  const baseUrl = rawBase.endsWith('/v1') ? rawBase : `${rawBase}/v1`;
  const model = String(process.env.LM_STUDIO_MODEL || DEFAULT_LM_STUDIO_MODEL);
  const timeoutMs = Number(process.env.LM_STUDIO_TIMEOUT_MS) || 180_000;

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: [{ role: 'user', content: buildPrompt(profile) }],
    temperature: 0.75,
    stream: false,
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const code = e?.cause?.code || e?.code || null;
    const extra = code ? ` (${code})` : '';
    throw new Error(`Cannot reach LM Studio at ${baseUrl}${extra}`);
  }

  if (!res.ok) {
    const errText = truncate(await res.text().catch(() => ''), 200);
    throw new Error(`LM Studio HTTP ${res.status}${errText ? `: ${errText}` : ''}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
  if (!text) throw new Error('LM Studio returned empty content');

  const parsed = extractJsonObject(text);
  if (!parsed) throw new Error('Failed to parse JSON from model response');
  return validateAndStampPosts(parsed);
}

