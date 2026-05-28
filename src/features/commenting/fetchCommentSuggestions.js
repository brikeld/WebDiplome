import { hash } from '@/lib/commentMetaStrip.js';

const GENERATE_API_ORIGIN =
  (import.meta?.env?.VITE_GENERATE_API_ORIGIN && String(import.meta.env.VITE_GENERATE_API_ORIGIN)) ||
  'http://localhost:3010';

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

export async function fetchCommentSuggestions(post, { allowedPersonas } = {}) {
  const body = {
    post: {
      content: post.content,
      persona: post.persona,
      attachedAsset: post.attachedAsset ?? null,
      chartType: post.chartType ?? null,
    },
  };
  if (Array.isArray(allowedPersonas) && allowedPersonas.length > 0 && allowedPersonas.length < 3) {
    body.allowedPersonas = allowedPersonas;
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
    return attachPlusValues(post.id, rows);
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

  return attachPlusValues(post.id, ordered);
}
