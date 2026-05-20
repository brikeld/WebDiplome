import { promises as fs } from 'fs';
import path from 'path';
import { normalizePersonaPercentTriplet } from './personaScores.js';

const PERSONA_ORDER = ['productivite', 'securite', 'popularite'];
const MAX_COMMENT_CHARS = 60;
/** Assistant prefill — model completes the string instead of starting with thinking prose. */
const JSON_CONTENT_PREFILL = '{"content":"';

const PERSONA_HINTS = {
  productivite: 'productivity, focus, throughput, dry wit about work',
  securite: 'security, risk, caution, audit mindset',
  popularite: 'social visibility, networking, playful public energy',
};

const PERSONA_ALIASES = {
  productivite: 'productivite',
  productivity: 'productivite',
  securite: 'securite',
  security: 'securite',
  popularite: 'popularite',
  popularity: 'popularite',
  social: 'popularite',
};

const LIST_KEYS = ['suggestions', 'comments', 'replies', 'options', 'propositions'];

function clampComment(text) {
  const t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= MAX_COMMENT_CHARS) return t;
  const cut = t.slice(0, MAX_COMMENT_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 24) return cut.slice(0, lastSpace).trim();
  return cut.trim();
}

function isLikelyThinkingText(text) {
  const t = String(text ?? '').trim();
  if (!t) return true;
  return /thinking\s*process|analyze\s+(the\s+)?request|^\s*\d+\.\s+\*\*/i.test(t);
}

function sanitizeParsedComment(text) {
  const c = clampComment(text);
  if (!c || isLikelyThinkingText(c)) return null;
  return c;
}

function buildChatBody({
  model,
  systemPrompt,
  userPayload,
  imageData,
  maxTokens = 120,
  temperature = 0.75,
  assistantPrefill = null,
  jsonMode = true,
}) {
  const userContent = imageData
    ? [
        { type: 'text', text: userPayload },
        { type: 'image_url', image_url: { url: `data:${imageData.mime};base64,${imageData.base64}` } },
      ]
    : userPayload;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
  if (assistantPrefill) {
    messages.push({ role: 'assistant', content: assistantPrefill });
  }
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    enable_thinking: false,
  };
  if (jsonMode && !assistantPrefill) {
    body.response_format = { type: 'json_object' };
  }
  if (assistantPrefill) {
    body.stop = ['"\n', '\n\n', 'Thinking', '```', '</think>'];
  }
  return body;
}

async function fetchJsonWithTimeout(url, init, timeoutMs) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || text?.slice(0, 200) || res.statusText;
      throw new Error(String(msg));
    }
    return json ?? {};
  } finally {
    clearTimeout(id);
  }
}

async function lmChatCompletion({ baseUrl, timeoutMs, retries, body }) {
  const url = `${String(baseUrl).replace(/\/$/, '')}/v1/chat/completions`;
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJsonWithTimeout(
        url,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        timeoutMs,
      );
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (body?.response_format && /response_format|json_object|not supported|unsupported/i.test(msg)) {
        try {
          const { response_format, ...rest } = body;
          return await fetchJsonWithTimeout(
            url,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rest) },
            timeoutMs,
          );
        } catch (e2) {
          lastErr = e2;
          continue;
        }
      }
      lastErr = e;
    }
  }
  throw lastErr || new Error('LM Studio request failed');
}

function normalizePersonaKey(raw) {
  const k = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (PERSONA_ALIASES[k]) return PERSONA_ALIASES[k];
  if (PERSONA_ORDER.includes(k)) return k;
  return null;
}

function stripModelWrappers(text) {
  let t = String(text ?? '').trim();
  t = t.replace(/[\s\S]*?<\/think>/gi, '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  return t;
}

function tryParseJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractChoiceText(resp) {
  const msg = resp?.choices?.[0]?.message || {};
  return [msg.content, msg.reasoning_content].filter(Boolean).join('\n');
}

function extractModelTextForJson(resp) {
  const combined = stripModelWrappers(extractChoiceText(resp));

  const markers = [/\{\s*"suggestions"/i, /\{\s*"content"/i];
  for (const re of markers) {
    const matches = [...combined.matchAll(new RegExp(re.source, re.flags + 'g'))];
    const last = matches[matches.length - 1];
    if (last?.index != null) return combined.slice(last.index);
  }

  const start = combined.lastIndexOf('{');
  if (start >= 0) return combined.slice(start);
  return combined;
}

function lastContentFieldMatch(text) {
  const re = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/gi;
  let last = null;
  let m;
  while ((m = re.exec(text)) !== null) last = m;
  return last;
}

function contentFromRow(row) {
  if (row == null) return '';
  if (typeof row === 'string') return clampComment(row);
  return clampComment(row.content ?? row.text ?? row.comment ?? row.message ?? row.body ?? '');
}

function rowsFromParsed(obj) {
  if (!obj || typeof obj !== 'object') return [];

  if (Array.isArray(obj)) {
    return obj.map((row, i) => ({
      persona: normalizePersonaKey(row?.persona ?? row?.axis ?? row?.type) ?? PERSONA_ORDER[i],
      content: contentFromRow(row),
    }));
  }

  for (const key of LIST_KEYS) {
    if (Array.isArray(obj[key])) {
      return obj[key].map((row, i) => ({
        persona: normalizePersonaKey(row?.persona ?? row?.axis ?? row?.type) ?? PERSONA_ORDER[i],
        content: contentFromRow(row),
      }));
    }
  }

  const keyed = [];
  for (const [k, v] of Object.entries(obj)) {
    const persona = normalizePersonaKey(k);
    if (!persona) continue;
    keyed.push({ persona, content: contentFromRow(v) });
  }
  if (keyed.length) return keyed;

  return [];
}

function mergeRowsIntoOut(rows) {
  const out = {};
  for (const row of rows) {
    const persona = normalizePersonaKey(row.persona);
    if (!persona || !row.content) continue;
    out[persona] = row.content;
  }
  return Object.keys(out).length >= 3 ? out : null;
}

/** @returns {Record<string, string> | null} */
export function parseCommentSuggestionsResponse(raw) {
  const text = stripModelWrappers(raw);
  if (!text) return null;

  const slices = [text];
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) slices.push(text.slice(objStart, objEnd + 1));
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) slices.push(text.slice(arrStart, arrEnd + 1));

  for (const slice of slices) {
    const parsed = tryParseJson(slice);
    if (!parsed) continue;
    const merged = mergeRowsIntoOut(rowsFromParsed(parsed));
    if (merged) return merged;
  }

  return null;
}

function contentFromRegexMatch(m) {
  if (!m?.[1]) return null;
  try {
    return sanitizeParsedComment(JSON.parse(`"${m[1]}"`));
  } catch {
    return sanitizeParsedComment(m[1].replace(/\\"/g, '"'));
  }
}

/** Parse completion after assistant prefill `{"content":"`. */
export function parsePrefillSuggestion(rawFragment) {
  let frag = stripModelWrappers(String(rawFragment ?? ''));
  if (!frag) return null;

  const fromJson = parseSingleSuggestionContent(frag);
  if (fromJson) return fromJson;

  if (!frag.includes('{')) {
    frag = JSON_CONTENT_PREFILL + frag;
  } else if (!frag.trimStart().startsWith('{')) {
    const idx = frag.indexOf('{"content"');
    frag = idx >= 0 ? frag.slice(idx) : JSON_CONTENT_PREFILL + frag;
  }

  if (!frag.endsWith('}')) {
    const trimmed = frag.replace(/\s+$/, '');
    if (!trimmed.endsWith('"')) {
      frag = `${trimmed}"}`;
    } else {
      frag = `${trimmed}}`;
    }
  }

  const parsed = parseSingleSuggestionContent(frag);
  if (parsed) return parsed;

  const inner = frag.startsWith(JSON_CONTENT_PREFILL)
    ? frag.slice(JSON_CONTENT_PREFILL.length).replace(/"\s*\}.*$/s, '').replace(/^"/, '')
    : frag;
  const bare = inner.replace(/\\"/g, '"').trim();
  return sanitizeParsedComment(bare);
}

/** Parse a single {"content":"..."} reply (ignores thinking prose before JSON). */
export function parseSingleSuggestionContent(raw) {
  const stripped = stripModelWrappers(String(raw ?? ''));
  if (!stripped) return null;

  const lastField = lastContentFieldMatch(stripped);
  const fromField = contentFromRegexMatch(lastField);
  if (fromField) return fromField;

  const text = extractModelTextForJson({ choices: [{ message: { content: stripped } }] });
  const slices = [text, stripped];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) slices.push(text.slice(start, end + 1));

  for (const slice of slices) {
    const obj = tryParseJson(slice);
    if (!obj || typeof obj !== 'object') continue;
    const c = sanitizeParsedComment(contentFromRow(obj));
    if (c) return c;
  }

  return contentFromRegexMatch(lastContentFieldMatch(text));
}

function dominantPersonaKey(profile) {
  const d = String(profile?.dominantPersona ?? '').toLowerCase();
  if (d === 'productivity' || d === 'productivite') return 'productivite';
  if (d === 'security' || d === 'securite') return 'securite';
  if (d === 'social' || d === 'popularity' || d === 'popularite') return 'popularite';
  const scores = profile?.personaScores ? normalizePersonaPercentTriplet(profile.personaScores) : null;
  if (!scores) return 'productivite';
  const entries = [
    ['productivite', scores.productivity],
    ['securite', scores.security],
    ['popularite', scores.social],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function buildCompactUserPayload(profile, post, mainPersona) {
  return JSON.stringify({
    commenter: {
      name: `${profile?.firstname ?? profile?.firstName ?? ''} ${profile?.lastname ?? profile?.lastName ?? ''}`.trim(),
      main_persona: mainPersona,
      bio: String(profile?.profileSummary ?? profile?.userDescription ?? '').slice(0, 280),
      scores_percent: profile?.personaScores
        ? normalizePersonaPercentTriplet(profile.personaScores)
        : null,
    },
    post: {
      content: String(post?.content ?? '').slice(0, 500),
      persona: post?.persona ?? null,
      has_image: !!(post?.attachedAsset && post.attachedAsset.kind === 'image'),
    },
  });
}

/** Plain-text payload for minimal retries (smaller than JSON — less thinking drift). */
function buildPlainUserPayload(profile, post, mainPersona) {
  const name = `${profile?.firstname ?? profile?.firstName ?? ''} ${profile?.lastname ?? profile?.lastName ?? ''}`.trim();
  const postText = String(post?.content ?? '').slice(0, 400);
  return [
    `Commenter: ${name || 'User'} (main persona: ${mainPersona}).`,
    `Post to reply to: ${postText}`,
    post?.attachedAsset?.kind === 'image' ? '(Post has an image; react to the caption only.)' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPrefillSuggestionPrompt(persona, mainPersona) {
  const dominantNote =
    persona === mainPersona ? 'Dominant persona voice.' : 'Different persona than dominant.';
  return [
    'Complete the in-progress assistant JSON. It already starts {"content":',
    `Write ONLY the reply text (max ${MAX_COMMENT_CHARS} chars), then close with "}.`,
    `Voice: ${persona} — ${PERSONA_HINTS[persona]}. ${dominantNote}`,
    'First person, casual English. React to the user post. No explanation. /no_think',
  ].join(' ');
}

function buildMinimalSuggestionPrompt(persona) {
  return `Finish {"content":" with one ${persona} reply (max ${MAX_COMMENT_CHARS} chars). English, first person. Close with "}. /no_think`;
}

export async function loadPostImageBase64(attachedAsset, uploadsDir) {
  if (!attachedAsset || attachedAsset.kind !== 'image') return null;
  const url = String(attachedAsset.url ?? '');
  const filename = String(attachedAsset.filename ?? '');
  let filePath = null;
  if (url.startsWith('/uploads/')) {
    filePath = path.join(uploadsDir, path.basename(url));
  } else if (filename) {
    filePath = path.join(uploadsDir, path.basename(filename));
  }
  if (!filePath) return null;
  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png' :
      ext === '.webp' ? 'image/webp' :
      ext === '.gif' ? 'image/gif' :
      'image/jpeg';
    return { base64: buf.toString('base64'), mime };
  } catch {
    return null;
  }
}

async function generateOneSuggestion({
  persona,
  mainPersona,
  baseUrl,
  model,
  userPayload,
  plainUserPayload,
  timeoutMs,
  retries,
}) {
  const strategies = [
    {
      label: 'prefill',
      systemPrompt: buildPrefillSuggestionPrompt(persona, mainPersona),
      payload: userPayload,
      assistantPrefill: JSON_CONTENT_PREFILL,
      maxTokens: 96,
      temperature: 0.55,
    },
    {
      label: 'prefill-plain',
      systemPrompt: buildMinimalSuggestionPrompt(persona),
      payload: plainUserPayload,
      assistantPrefill: JSON_CONTENT_PREFILL,
      maxTokens: 128,
      temperature: 0.45,
    },
  ];

  let lastRaw = '';
  for (let i = 0; i < strategies.length; i += 1) {
    const s = strategies[i];
    const body = buildChatBody({
      model,
      systemPrompt: s.systemPrompt,
      userPayload: s.payload,
      imageData: null,
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      assistantPrefill: s.assistantPrefill,
      jsonMode: false,
    });

    let resp;
    try {
      resp = await lmChatCompletion({ baseUrl, timeoutMs, retries, body });
    } catch (e) {
      console.warn(`[comments/suggest] ${persona} ${s.label} LM error:`, String(e?.message ?? e));
      continue;
    }

    const choiceText = extractChoiceText(resp);
    lastRaw = choiceText;
    if (!choiceText.trim()) {
      console.warn(`[comments/suggest] ${persona} ${s.label} empty completion`);
      continue;
    }

    const content = parsePrefillSuggestion(choiceText);

    if (content) {
      if (i > 0) {
        console.log(`[comments/suggest] ${persona} ok on attempt ${i + 1} (${s.label})`);
      }
      return content;
    }

    console.warn(
      `[comments/suggest] ${persona} ${s.label} parse failed; len=${lastRaw.length}; head:`,
      lastRaw.slice(0, 200),
    );
  }

  console.warn(
    `[comments/suggest] ${persona} all attempts failed; len=${lastRaw.length}; tail:`,
    lastRaw.slice(-200),
  );
  throw new Error(`Could not parse ${persona} suggestion`);
}

/**
 * Three sequential LM calls (one per persona) — avoids LM Studio overload and
 * thinking models colliding on parallel requests.
 */
export async function generateCommentSuggestions({
  baseUrl,
  model,
  profile,
  post,
  electronData: _electronData = null,
  electronUser: _electronUser = null,
  uploadsDir,
  timeoutMs = 120000,
  retries = 1,
}) {
  const mainPersona = dominantPersonaKey(profile);
  const userPayload = buildCompactUserPayload(profile, post, mainPersona);
  const plainUserPayload = buildPlainUserPayload(profile, post, mainPersona);

  const results = [];
  for (let index = 0; index < PERSONA_ORDER.length; index += 1) {
    const persona = PERSONA_ORDER[index];
    const content = await generateOneSuggestion({
      persona,
      mainPersona,
      baseUrl,
      model,
      userPayload,
      plainUserPayload,
      timeoutMs,
      retries,
    });
    results.push({
      persona,
      content,
      plusValue: ((index + 1) % 5) + 1,
    });
  }

  return results;
}
