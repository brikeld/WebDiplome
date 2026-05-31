import { hash } from '@/lib/commentMetaStrip.js';
import {
  loadCommentSuggestions,
  saveCommentSuggestions,
} from '@/lib/commentSuggestionsStorage.js';
import { isHostedApiOrigin, profileSlugFromProfile, slimProfileForAiRequest, submitQueuedAiEndpoint } from '@/lib/aiJobClient.js';
import { canUseHostedAccountFeatures, readLinkedProfileSlug } from '@/lib/hostedAccount.js';
import { resolveGenerateApiOrigin } from '@/lib/apiOrigin.js';

const GENERATE_API_ORIGIN = resolveGenerateApiOrigin();

const PERSONA_ORDER = ['productivite', 'securite', 'popularite'];

function attachPlusValues(postId, suggestions) {
  const base = hash(String(postId));
  return suggestions.map((s, i) => ({
    ...s,
    slotKey: `${s.persona}-${s.slotIndex ?? i}`,
    plusValue:
      Number(s.plusValue) ||
      ((hash(`${postId}|suggestion|${s.persona}|${s.slotIndex ?? i}`) + base) % 5) + 1,
  }));
}

function normalizeSuggestions(postId, raw, allowedPersonas) {
  if (
    Array.isArray(allowedPersonas) &&
    allowedPersonas.length === 1 &&
    raw.length >= 3
  ) {
    const persona = String(allowedPersonas[0]).toLowerCase();
    const rows = raw
      .filter((s) => String(s.persona ?? '').toLowerCase() === persona)
      .slice(0, 3)
      .map((s, i) => ({
        persona,
        content: String(s.content ?? '').trim(),
        plusValue: Number(s.plusValue) || 1,
        slotIndex: Number(s.slotIndex) >= 0 ? Number(s.slotIndex) : i,
      }));
    if (rows.length < 3 || rows.some((s) => !s.content)) {
      throw new Error('Incomplete suggestions from server');
    }
    return attachPlusValues(postId, rows);
  }

  const byPersona = Object.fromEntries(
    raw.map((s) => [String(s.persona ?? '').toLowerCase(), s]),
  );

  const order =
    Array.isArray(allowedPersonas) && allowedPersonas.length === 2
      ? allowedPersonas.map((p) => String(p).toLowerCase())
      : PERSONA_ORDER;

  const ordered = order.map((persona) => {
    const row = byPersona[persona];
    return {
      persona,
      content: String(row?.content ?? '').trim(),
      plusValue: Number(row?.plusValue) || 1,
      slotIndex: Number(row?.slotIndex) >= 0 ? Number(row.slotIndex) : 0,
    };
  });

  if (ordered.some((s) => !s.content)) {
    throw new Error('Incomplete suggestions from server');
  }

  return attachPlusValues(postId, ordered);
}

/** In-flight comment requests keyed by viewer + post (React Strict Mode / reopen). */
const commentInflight = new Map();

/**
 * Comment suggestions are per logged-in viewer + post (not shared between users).
 * @param {object} post — post being commented on
 * @param {{ allowedPersonas?: string[], viewerProfile?: object }} options
 */
export async function fetchCommentSuggestions(post, { allowedPersonas, viewerProfile } = {}) {
  const viewerSlug = profileSlugFromProfile(viewerProfile);
  const cached = loadCommentSuggestions(viewerSlug, post.id);
  if (cached?.length) return cached;

  const inflightKey = `${viewerSlug || 'anon'}|${post.id}`;
  if (commentInflight.has(inflightKey)) {
    return commentInflight.get(inflightKey);
  }

  const run = (async () => {
  const body = {
    post: {
      id: post.id,
      content: post.content,
      persona: post.persona,
      attachedAsset: post.attachedAsset ?? null,
      chartType: post.chartType ?? null,
    },
  };
  if (Array.isArray(allowedPersonas) && allowedPersonas.length > 0 && allowedPersonas.length < 3) {
    body.allowedPersonas = allowedPersonas;
  }
  const slimViewer = slimProfileForAiRequest(viewerProfile);
  if (slimViewer) {
    body.viewerProfile = slimViewer;
    body.profile = slimViewer;
  }
  const viewerProfileSlug = profileSlugFromProfile(viewerProfile);
  if (viewerProfileSlug) {
    body.viewerProfileSlug = viewerProfileSlug;
    body.profileSlug = viewerProfileSlug;
  }

  if (isHostedApiOrigin()) {
    const linkedSlug = readLinkedProfileSlug();
    if (!linkedSlug) {
      throw new Error('Open this profile from the Compliant app (View on web) to use AI comments.');
    }
    if (!canUseHostedAccountFeatures(viewerProfile, linkedSlug)) {
      throw new Error('AI comments are only available on your linked profile.');
    }
    const result = await submitQueuedAiEndpoint('/api/comments/suggest', body);
    const raw = Array.isArray(result?.suggestions) ? result.suggestions : [];
    const normalized = normalizeSuggestions(post.id, raw, allowedPersonas);
    saveCommentSuggestions(viewerSlug, post.id, normalized);
    return normalized;
  }

  const res = await fetch(`${GENERATE_API_ORIGIN}/api/comments/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let msg = `Comment suggestions failed (${res.status})`;
    try {
      const j = JSON.parse(errText);
      if (j?.error) msg = j.error;
    } catch {
      if (errText) msg = errText.slice(0, 200);
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const raw = Array.isArray(data?.suggestions) ? data.suggestions : [];
  const normalized = normalizeSuggestions(post.id, raw, allowedPersonas);
  saveCommentSuggestions(viewerSlug, post.id, normalized);
  return normalized;
  })();

  commentInflight.set(inflightKey, run);
  try {
    return await run;
  } finally {
    if (commentInflight.get(inflightKey) === run) {
      commentInflight.delete(inflightKey);
    }
  }
}
