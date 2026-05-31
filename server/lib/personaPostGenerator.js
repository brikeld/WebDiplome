/**
 * Three-slot persona post generation.
 *
 * Slots:
 *   0 — text   : LLM-only; context from a rotating data slice
 *   1 — asset  : LLM + random file (image/pdf/screenshot) from Electron assets
 *   2 — chart  : LLM + algorithmically generated chart PNG
 *
 * Persona is data-driven: determined by the slice/chart type chosen, not the slot.
 */

import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import {
  extractBrowserSlice,
  extractWifiSlice,
  extractDownloadsSlice,
  extractMostUsedAppsSlice,
  formatBrowserSliceAsText,
  formatWifiSliceAsText,
  formatDownloadsAsText,
  formatAppUsageAsText,
} from './dataSlices.js';
import { pickAndBuildChart } from './chartGenerator.js';
import { renderSvgToPng } from './chartRenderer.js';
import { pickBoardToPost, cloneHiddenForBoard } from './leaderboards.js';
import { DEFAULT_SLOT_PROMPTS } from './prompts.js';
import {
  parseRationalesResponse,
  buildRationalesPayload,
  fallbackRationales,
  parseClimbTipResponse,
  buildClimbTipPayload,
  fallbackClimbTip,
} from './leaderboardRationales.js';
import { normalizePersonaPercentTriplet } from './personaScores.js';
import { synthesiseChartMetadata } from '../../src/lib/chartPostMetadata.js';

/** Slot index for the asset slot (image or document from disk). */
export const ASSET_SLOT_INDEX = 1;

// ─── Text slice pool ───────────────────────────────────────────────────────

const TEXT_SLICE_POOL = [
  {
    id: 'browser',
    persona: 'popularite',
    promptKey: 'browser',
    extract: (data) => extractBrowserSlice(data || {}),
    format: formatBrowserSliceAsText,
  },
  {
    id: 'wifi',
    persona: 'securite',
    promptKey: 'wifi',
    extract: (data) => extractWifiSlice(data || {}),
    format: formatWifiSliceAsText,
  },
  {
    id: 'downloads',
    persona: 'securite',
    promptKey: 'downloads',
    extract: (data) => extractDownloadsSlice(data || {}),
    format: formatDownloadsAsText,
  },
  {
    id: 'app_usage',
    persona: 'productivite',
    promptKey: 'app_usage',
    extract: (data) => extractMostUsedAppsSlice(data || {}),
    format: formatAppUsageAsText,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function getRecentFieldValues(posts, field, n = 3) {
  return posts
    .filter((p) => p && typeof p[field] === 'string')
    .slice(0, n)
    .map((p) => p[field]);
}

function personaScoreFor(persona, scores) {
  if (!scores) return 50;
  if (persona === 'productivite') return scores.productivity ?? 50;
  if (persona === 'securite') return scores.security ?? 50;
  if (persona === 'popularite') return scores.social ?? 50;
  return 50;
}

function weightedPick(items, getWeight) {
  const weights = items.map((item) => Math.max(1, getWeight(item)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickWithRecencyGuard(pool, recentIds, personaScores) {
  const excludeSet = new Set(recentIds);
  const available = pool.filter((item) => !excludeSet.has(item.id));
  const candidates = available.length > 0 ? available : pool;
  return weightedPick(candidates, (item) => personaScoreFor(item.persona, personaScores));
}

function imageTextFallbackNote(filename) {
  return `\n\nFor context, the user recently had a file named "${filename}" — you may reference it naturally in the post.`;
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    if (!resp.ok) {
      const msg = json?.error?.message || json?.error || text || `HTTP ${resp.status}`;
      throw new Error(msg);
    }
    return json ?? {};
  } finally {
    clearTimeout(id);
  }
}

/** Omit max_tokens from API calls unless LM_STUDIO_MAX_TOKENS is set — LM Studio then uses your server UI limits (e.g. full context). */
function resolveMaxTokens() {
  const env = process.env.LM_STUDIO_MAX_TOKENS;
  if (env == null || String(env).trim() === '') return null;
  const n = parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildChatBody({ model, systemPrompt, userPayload, imageData, docText, docFilename, maxTokens, temperature = 0.7 }) {
  let userContent;
  if (imageData) {
    userContent = [
      { type: 'text', text: userPayload },
      { type: 'image_url', image_url: { url: `data:${imageData.mime};base64,${imageData.base64}` } },
    ];
  } else if (docText) {
    userContent = `${userPayload}\n\n--- Attached document (${docFilename}) ---\n${docText}`;
  } else {
    userContent = userPayload;
  }
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  };
  const resolvedMaxTokens = maxTokens ?? resolveMaxTokens();
  if (resolvedMaxTokens != null) body.max_tokens = resolvedMaxTokens;
  return body;
}

async function lmChatCompletion({ baseUrl, timeoutMs, retries, body }) {
  const url = `${String(baseUrl).replace(/\/$/, '')}/v1/chat/completions`;
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchJsonWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, timeoutMs);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (body?.response_format && /response_format|json_object|not supported|unsupported/i.test(msg)) {
        try {
          const { response_format, ...rest } = body;
          return await fetchJsonWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rest) }, timeoutMs);
        } catch (e2) { lastErr = e2; continue; }
      }
      lastErr = e;
    }
  }
  throw lastErr || new Error('LM Studio request failed');
}

function extractChoiceText(resp) {
  const msg = resp?.choices?.[0]?.message || {};
  return (msg.content && msg.content.trim()) || (msg.reasoning_content && msg.reasoning_content.trim()) || '';
}

function normalizeSentiment(s) {
  const v = String(s || '').trim().toLowerCase();
  return v === 'positive' || v === 'negative' ? v : null;
}

const INFERENCE_CHAIN_STEPS = ['data', 'classify', 'infer', 'generate'];
const INFERENCE_CHAIN_CONFIDENCES = new Set(['high', 'med', 'low']);
const INFERENCE_CHAIN_VALUE_MAX = 220;
const INGREDIENT_LABEL_MAX = 48;
const INGREDIENT_DATAPOINT_MAX = 80;
const INGREDIENT_COUNT = 3;
const HIGHLIGHT_PHRASE_MAX = 80;
const THINKING_LABEL_MAX = 32;
const THINKING_DETAIL_MAX = 180;
const THINKING_MIN = 3;
const THINKING_MAX = 5;

// Appended to every slot system prompt; explains the inferenceChain output schema,
// the ingredients summary, and the highlight ↔ chain/ingredient mapping.
export const INFERENCE_CHAIN_INSTRUCTION = `

Additional output fields — "inferenceChain", "ingredients", "highlights":

1) "inferenceChain" — array of EXACTLY 4 step objects in this order, revealing how the algorithm went from raw user data to the post sentence:

[
  { "step": "data",     "value": "<a HUMAN-READABLE sentence describing one concrete signal from the user data, e.g. '42 .png files created in the last week' or 'Screenshot captured at 22:44 named Screenshot 2026-04-28' or 'Cursor and Claude opened back-to-back this afternoon'. NEVER mention internal field names, JSON paths, or keys like 'attached_image', 'app_usage_7days', 'MACHINE_IDENTITY'. Write as a journalist would describe what the system saw.>", "source": "<short human label for where the signal came from, e.g. 'Recent files', 'App usage (last 7 days)', 'Screenshot library', 'Browser history'. NEVER a JSON path or field name.>" },
  { "step": "classify", "value": "<short label categorizing that signal>", "confidence": "high" },
  { "step": "infer",    "value": "<a reductive, biased, or oversimplified judgment the algorithm draws from the classification>", "confidence": "low", "isBiased": true, "biasNote": "<one sentence admitting why this judgment is superficial or unfair>" },
  { "step": "generate", "value": "<the exact phrase or sentence from the 'content' field that this chain produced — must appear verbatim inside 'content'>" }
]

The "infer" step MUST be a leap — make it sound like an algorithm making a snap judgment. Keep each value under 180 characters.

2) "ingredients" — array of EXACTLY 3 objects describing the data categories that fed the post, each with a relative weight (0–100) and concrete data points:

[
  { "label": "<short category name, e.g. 'Installed apps', 'Activity rhythm', 'Risk signals', 'Location signals', 'Recent files', 'Browsing patterns'>", "weight": <integer 30–95>, "dataPoints": ["<concrete raw value 1>", "<concrete raw value 2>", "<concrete raw value 3>", "..."] }
]

Include as MANY dataPoints per ingredient as the source data supports (5–12 ideal). Data points are real, specific values from the data — app names, file names, timestamps, wifi SSIDs, URLs, file extensions, etc. NEVER internal field names.

3) "highlights" — array of 2–3 short phrases from "content" that map onto the chain steps and ingredients. Each highlight links one literal substring of "content" to a chain step and an ingredient:

[
  { "phrase": "<exact substring that appears VERBATIM in 'content'>", "stepIndex": <0|1|2|3>, "ingredientIndex": <0|1|2> }
]

Pick phrases the reader would want to interrogate ("42 PNGs", "tricky design logic", "FigmaAgent and Claude"). They MUST appear character-for-character inside "content".

4) "thinking" — array of EXACTLY 3 to 5 short objects describing the model's internal reasoning while writing this post. Each is a small thought, written as if the model is thinking out loud in first-person ("I noticed...", "I almost said...", "I picked..."). Must be specific to this user's data, not generic. Each entry has a tiny LABEL (1–3 words, ALL CAPS, no punctuation) and a DETAIL (one short sentence, plain text, max 180 chars):

[
  { "label": "WHAT I SAW",      "detail": "<one specific concrete observation about the user data, e.g. '12 .fig files modified yesterday — peak around 23:00.'>" },
  { "label": "WHAT I IGNORED",  "detail": "<one specific signal you considered then dropped, e.g. 'The Spotify history — interesting but off-topic for productivity persona.'>" },
  { "label": "WHY THIS ANGLE",  "detail": "<why you wrote the post the way you did, in plain language>" },
  { "label": "WORD I PICKED",   "detail": "<one specific word/phrase choice and why, e.g. 'Said \"basically a map of caffeine\" because the wifi names skewed café-heavy.'>" },
  { "label": "ALMOST WROTE",    "detail": "<the alternate post you considered first and rejected, in plain words>" }
]

These five labels are EXAMPLES — feel free to swap any of them for a more specific label, but keep the 1–3 word ALL-CAPS rule, and keep the detail concrete and grounded in the data the system saw. NO generic phrases like "I analyzed the data" — always cite a real artefact from the user data above.

Return the full envelope: {"content":"...","sentiment":"positive"|"negative","inferenceChain":[…4…],"ingredients":[…3…],"highlights":[…2-3…],"thinking":[…3-5…]}.`;

/** Legacy slot prompts ask for content+sentiment only; strip that so the full envelope wins. */
const LEGACY_CONTENT_ONLY_JSON_RETURN =
  /\nReturn ONLY valid JSON:\s*\{[^}]*"content"[^}]*\}\.\s*(?:\/no_think)?\s*/gi;

function injectInferenceChainInstruction(systemPrompt) {
  const base = String(systemPrompt || '').trim();
  if (!base) return INFERENCE_CHAIN_INSTRUCTION.trim();
  if (base.includes('"inferenceChain"') && base.includes('ingredients')) return base;

  const stripped = base.replace(LEGACY_CONTENT_ONLY_JSON_RETURN, '\n').trim();
  if (stripped.includes('"inferenceChain"')) return stripped;
  return `${stripped}${INFERENCE_CHAIN_INSTRUCTION}`;
}

function clipChainValue(value) {
  const t = String(value || '').trim();
  if (!t) return '';
  if (t.length <= INFERENCE_CHAIN_VALUE_MAX) return t;
  const cut = t.slice(0, INFERENCE_CHAIN_VALUE_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > INFERENCE_CHAIN_VALUE_MAX / 2 ? cut.slice(0, lastSpace) : cut).trim();
}

function looksLikeInternalKey(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  // Heuristic for snake_case keys, dotted paths, or [index] subscripts.
  return /[_.\[]/.test(t) && /^[A-Za-z0-9_.\[\]]+$/.test(t);
}

function sanitizeReadable(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return looksLikeInternalKey(t) ? '' : t;
}

function normalizeInferenceChain(raw) {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const out = [];
  for (let i = 0; i < 4; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object') return null;
    const expected = INFERENCE_CHAIN_STEPS[i];
    const step = String(item.step || '').trim().toLowerCase();
    if (step !== expected) return null;
    const value = clipChainValue(item.value);
    if (!value) return null;
    const entry = { step, value };
    if (step === 'data') {
      const readable = sanitizeReadable(item.source);
      if (readable) entry.source = clipChainValue(readable);
    }
    if (step === 'classify' || step === 'infer') {
      const conf = String(item.confidence || '').trim().toLowerCase();
      if (INFERENCE_CHAIN_CONFIDENCES.has(conf)) entry.confidence = conf;
    }
    if (step === 'infer') {
      entry.isBiased = item.isBiased === true || item.isBiased === 'true';
      if (typeof item.biasNote === 'string' && item.biasNote.trim()) {
        entry.biasNote = clipChainValue(item.biasNote);
      }
    }
    out.push(entry);
  }
  return out;
}

function clipText(value, max) {
  const t = String(value || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trim();
}

function normalizeIngredients(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const label = clipText(item.label, INGREDIENT_LABEL_MAX);
    if (!label) continue;
    let weight = Number(item.weight);
    if (!Number.isFinite(weight)) weight = 50;
    weight = Math.max(5, Math.min(100, Math.round(weight)));
    const points = Array.isArray(item.dataPoints) ? item.dataPoints : [];
    const dataPoints = [];
    for (const p of points) {
      const cleaned = clipText(p, INGREDIENT_DATAPOINT_MAX);
      if (cleaned && !looksLikeInternalKey(cleaned)) dataPoints.push(cleaned);
    }
    if (!dataPoints.length) continue;
    out.push({ label, weight, dataPoints });
    if (out.length >= INGREDIENT_COUNT) break;
  }
  return out.length === INGREDIENT_COUNT ? out : null;
}

function normalizeThinking(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const labelRaw = String(item.label || '').trim();
    const detailRaw = String(item.detail || item.text || item.value || '').trim();
    if (!labelRaw || !detailRaw) continue;
    if (looksLikeInternalKey(labelRaw) || looksLikeInternalKey(detailRaw)) continue;
    const label = clipText(labelRaw, THINKING_LABEL_MAX).toUpperCase();
    const detail = clipText(detailRaw, THINKING_DETAIL_MAX);
    if (!label || !detail) continue;
    out.push({ label, detail });
    if (out.length >= THINKING_MAX) break;
  }
  return out.length >= THINKING_MIN ? out : null;
}

/**
 * Last-resort fallback when the model omits "thinking" — we paraphrase the
 * inference chain + the heaviest ingredient into a believable internal monologue
 * so the UI always has at least 3 capsules to display. Generic but grounded.
 */
function synthesiseThinking(parsed, persona) {
  const chain = Array.isArray(parsed?.inferenceChain) ? parsed.inferenceChain : null;
  const ingredients = Array.isArray(parsed?.ingredients) ? parsed.ingredients : null;
  if (!chain && !ingredients) return null;

  const out = [];
  const dataStep = chain?.find((s) => s?.step === 'data');
  const inferStep = chain?.find((s) => s?.step === 'infer');
  const heaviestIng = ingredients?.length
    ? [...ingredients].sort((a, b) => Number(b.weight ?? 0) - Number(a.weight ?? 0))[0]
    : null;

  if (dataStep?.value) {
    out.push({ label: 'WHAT I SAW', detail: clipText(dataStep.value, THINKING_DETAIL_MAX) });
  }
  if (heaviestIng?.label) {
    out.push({
      label: 'WHAT WEIGHED MOST',
      detail: clipText(`${heaviestIng.label} carried the most weight here.`, THINKING_DETAIL_MAX),
    });
  }
  if (inferStep?.value) {
    out.push({
      label: 'THE LEAP',
      detail: clipText(inferStep.value, THINKING_DETAIL_MAX),
    });
  }
  if (inferStep?.biasNote) {
    out.push({
      label: 'WHERE I CHEATED',
      detail: clipText(inferStep.biasNote, THINKING_DETAIL_MAX),
    });
  }
  if (!out.length) {
    out.push({
      label: 'PERSONA LENS',
      detail: `I read this through the ${persona || 'productivite'} persona filter.`,
    });
  }
  return out.length >= THINKING_MIN ? out : null;
}

function normalizeHighlights(raw, content, ingredientsCount) {
  if (!Array.isArray(raw) || !content) return null;
  const out = [];
  const lowerContent = content.toLowerCase();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const phrase = clipText(item.phrase, HIGHLIGHT_PHRASE_MAX);
    if (!phrase) continue;
    if (lowerContent.indexOf(phrase.toLowerCase()) === -1) continue;
    const stepIndex = Math.max(0, Math.min(3, Number(item.stepIndex)));
    if (!Number.isFinite(Number(item.stepIndex))) continue;
    const ingRaw = Number(item.ingredientIndex);
    const ingredientIndex = Number.isFinite(ingRaw)
      ? Math.max(0, Math.min(ingredientsCount - 1, ingRaw))
      : 0;
    out.push({ phrase, stepIndex, ingredientIndex });
    if (out.length >= 4) break;
  }
  return out.length ? out : null;
}

function extractContentField(jsonText) {
  const m = jsonText.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  try { return JSON.parse('"' + m[1] + '"').trim() || null; }
  catch { return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\').trim() || null; }
}

function fixInvalidDataPoints(jsonText) {
  // LLMs sometimes emit ["key": num, ...] instead of ["key", ...] inside dataPoints arrays
  return jsonText.replace(
    /("dataPoints"\s*:\s*\[)([\s\S]*?)(\])/g,
    (_, pre, body, post) => pre + body.replace(/"([^"]+)"\s*:\s*(-?\d+(?:\.\d+)?)/g, '"$1: $2"') + post,
  );
}

function parsePostResponse(raw, fallbackPersona) {
  let text = (raw || '').trim();
  if (!text) return { content: '', sentiment: null, inferenceChain: null, thinking: null };

  // Strip markdown code fences
  if (text.startsWith('```')) {
    const firstNewline = text.indexOf('\n');
    if (firstNewline !== -1) {
      text = text.slice(firstNewline + 1);
      const closingFence = text.lastIndexOf('\n```');
      text = (closingFence !== -1 ? text.slice(0, closingFence) : text.replace(/```\s*$/, '')).trim();
    }
  }

  const tryParse = (slice) => {
    try {
      const obj = JSON.parse(slice);
      if (obj && typeof obj === 'object') {
        const content = typeof obj.content === 'string' ? obj.content.trim() : '';
        if (!content) return null;
        const ingredients = normalizeIngredients(obj.ingredients);
        const highlights = ingredients
          ? normalizeHighlights(obj.highlights, content, ingredients.length)
          : null;
        return {
          content,
          sentiment: normalizeSentiment(obj.sentiment),
          inferenceChain: normalizeInferenceChain(obj.inferenceChain),
          ingredients,
          highlights,
          thinking: normalizeThinking(obj.thinking),
        };
      }
    } catch { /* ignore */ }
    return null;
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    const inner = tryParse(slice);
    if (inner) return inner;

    // Fix invalid object-style entries inside dataPoints arrays and retry
    const fixed = fixInvalidDataPoints(slice);
    if (fixed !== slice) {
      const fixedParsed = tryParse(fixed);
      if (fixedParsed) return fixedParsed;
    }

    // Regex fallback: at minimum extract the content field
    const extracted = extractContentField(slice);
    if (extracted) {
      const inferred = fallbackPersona === 'securite' ? 'negative' : 'positive';
      return { content: extracted, sentiment: inferred, inferenceChain: null, ingredients: null, highlights: null, thinking: null };
    }
  }

  const inferred = fallbackPersona === 'securite' ? 'negative' : 'positive';
  return { content: text, sentiment: inferred, inferenceChain: null, ingredients: null, highlights: null, thinking: null };
}

function postMetadataComplete(parsed) {
  return Boolean(
    parsed?.inferenceChain
    && parsed?.ingredients
    && parsed?.thinking,
  );
}

/**
 * Text-only follow-up when the model returned caption JSON but dropped analysis fields
 * (common for chart vision calls that truncate or obey the legacy content-only return line).
 */
async function fetchPostMetadataOnly({
  slot,
  content,
  baseUrl,
  timeoutMs,
  retries,
}) {
  const systemPrompt = injectInferenceChainInstruction(
    'The social post text is LOCKED — do not rewrite or paraphrase it. '
    + 'Return ONLY JSON with inferenceChain, ingredients, highlights, and thinking for that exact content.',
  );
  const chartNote = slot.chartType
    ? `\nChart annex type: ${slot.chartType} (user saw a chart image with this post).`
    : '';
  const userPayload = `LOCKED post content (must appear verbatim in highlights and in inferenceChain "generate" step):\n${JSON.stringify(content)}${chartNote}\n\n---\n${slot.userPayload}`;

  const body = buildChatBody({
    model: slot._model,
    systemPrompt,
    userPayload,
    imageData: null,
    docText: slot.docText || null,
    docFilename: slot.docFilename || null,
    temperature: 0.35,
    maxTokens: 2100,
  });
  const text = extractChoiceText(
    await lmChatCompletion({ baseUrl, timeoutMs, retries, body }),
  );
  const parsed = parsePostResponse(text, slot.persona);
  return {
    inferenceChain: parsed.inferenceChain,
    ingredients: parsed.ingredients,
    highlights: parsed.highlights,
    thinking: parsed.thinking,
  };
}

function applyChartMetadataFallback(parsed, slot) {
  if (!parsed.content || !slot.chartType || parsed.inferenceChain) return parsed;
  const synth = synthesiseChartMetadata({
    content: parsed.content,
    chartType: slot.chartType,
    persona: slot.persona,
  });
  if (!synth) return parsed;
  return {
    ...parsed,
    inferenceChain: parsed.inferenceChain || synth.inferenceChain,
    ingredients: parsed.ingredients || synth.ingredients,
    highlights: parsed.highlights || synth.highlights,
    thinking: parsed.thinking || synth.thinking,
  };
}

// ─── Slot builders ─────────────────────────────────────────────────────────

function buildTextSlot(dataJson, baseUserPayload, existingPosts, SP, personaScores) {
  const recentTypes = getRecentFieldValues(existingPosts, 'textSliceType');
  const chosen = pickWithRecencyGuard(TEXT_SLICE_POOL, recentTypes, personaScores);
  if (!chosen) {
    return {
      id: 'text', persona: 'popularite', promptKey: 'browser',
      userPayload: baseUserPayload, imageData: null, docText: null,
      docFilename: null, attachedAsset: null, textSliceType: 'browser',
    };
  }
  const slice = chosen.extract(dataJson);
  const ctx = chosen.format(slice);
  return {
    id: 'text',
    persona: chosen.persona,
    promptKey: chosen.promptKey,
    userPayload: ctx ? `${ctx}\n\n---\n${baseUserPayload}` : baseUserPayload,
    imageData: null,
    docText: null,
    docFilename: null,
    attachedAsset: null,
    textSliceType: chosen.id,
  };
}

async function buildChartSlot(dataJson, profile, baseUserPayload, existingPosts, chartUploadDir, personaScores) {
  const recentTypes = getRecentFieldValues(existingPosts, 'chartType');
  const chartSpec = pickAndBuildChart(dataJson, profile, recentTypes, personaScores);

  if (!chartSpec) {
    return {
      id: 'chart', persona: 'productivite', promptKey: 'chart',
      userPayload: baseUserPayload, imageData: null, docText: null,
      docFilename: null, attachedAsset: null, chartType: null,
    };
  }

  const pngBase64 = await renderSvgToPng(chartSpec.svg, chartSpec.w, chartSpec.h);
  if (!pngBase64) {
    return {
      id: 'chart', persona: chartSpec.persona, promptKey: 'chart',
      userPayload: baseUserPayload, imageData: null, docText: null,
      docFilename: null, attachedAsset: null, chartType: chartSpec.chartType,
    };
  }

  let filename = 'chart.png';
  let relativePath = null;
  let url = null;
  if (chartUploadDir) {
    const buf = Buffer.from(pngBase64, 'base64');
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    filename = `${hash}.png`;
    await fs.mkdir(chartUploadDir, { recursive: true });
    await fs.writeFile(path.join(chartUploadDir, filename), buf);
    url = `/uploads/${filename}`;
    relativePath = `public/uploads/${filename}`;
  }

  return {
    id: 'chart',
    persona: chartSpec.persona,
    promptKey: 'chart',
    userPayload: baseUserPayload,
    imageData: { base64: pngBase64, mime: 'image/png' },
    docText: null,
    docFilename: null,
    attachedAsset: { kind: 'image', filename, relativePath, url, mime: 'image/png', visionAnalysed: true },
    chartType: chartSpec.chartType,
  };
}

function buildAssetSlot(baseUserPayload, assetAssignment) {
  const slot = {
    id: 'asset',
    persona: 'popularite',
    promptKey: 'image',
    userPayload: baseUserPayload,
    imageData: null,
    docText: null,
    docFilename: null,
    attachedAsset: null,
  };

  if (!assetAssignment) return slot;

  const asset = assetAssignment.asset;
  if (asset.kind === 'image' && !asset.textFallbackOnly && asset.base64) {
    slot.imageData = { base64: asset.base64, mime: asset.mime };
    slot.promptKey = 'image';
    slot.persona = 'popularite';
  } else if (asset.kind === 'image') {
    slot.userPayload = baseUserPayload + imageTextFallbackNote(asset.filename || 'image');
    slot.promptKey = 'image';
    slot.persona = 'popularite';
  } else {
    slot.docText = asset.text;
    slot.docFilename = asset.filename;
    slot.promptKey = 'document';
    slot.persona = 'productivite';
  }
  slot.attachedAsset = {
    kind: asset.kind,
    filename: asset.filename,
    relativePath: asset.relativePath ?? null,
    url: asset.url ?? null,
    mime: asset.mime ?? 'application/octet-stream',
  };

  return slot;
}

function buildLeaderboardSlot(dataJson, profile, baseUserPayload, existingPosts, nowMs) {
  const pick = pickBoardToPost(dataJson, profile, existingPosts, nowMs);
  if (!pick) return null;

  const { board, standing, prevRank } = pick;
  const cloneHidden = cloneHiddenForBoard(board.id);
  const ctxLines = [
    '[Leaderboard slot]',
    `Board: ${board.title}`,
    `Your rank: ${standing.userRank}${prevRank != null ? ` (was ${prevRank})` : ' (new appearance)'}`,
    `Score signal hint: ${standing.hint}`,
  ];
  const ctx = ctxLines.join('\n');

  return {
    id: 'leaderboard',
    persona: board.persona,
    promptKey: 'leaderboard',
    userPayload: `${ctx}\n\n---\n${baseUserPayload}`,
    imageData: null,
    docText: null,
    docFilename: null,
    attachedAsset: null,
    leaderboardContext: { board, standing, cloneHidden },
    leaderboard: {
      boardId: board.id,
      title: board.title,
      persona: board.persona,
      cloneHidden,
      userRank: standing.userRank,
      previousUserRank: prevRank,
      entries: standing.entries.map((e) => ({
        rank: e.rank,
        name: e.name,
        handle: e.handle,
        avatarSrc: e.avatarSrc,
        avatarInitials: e.avatarInitials,
        score: e.score,
        isUser: e.isUser,
      })),
    },
  };
}

// ─── Slot runner ───────────────────────────────────────────────────────────

async function runSlot(slot, { baseUrl, timeoutMs, retries, SP, preferMetadataFallback = false }) {
  const promptCfg = SP[slot.promptKey] ?? DEFAULT_SLOT_PROMPTS.browser;
  const systemPrompt = injectInferenceChainInstruction(promptCfg.system);
  const maxTokens = Math.max(promptCfg.maxTokens || 900, 2100);

  const runOnce = async (temperature, withVision) => {
    const body = buildChatBody({
      model: slot._model,
      systemPrompt,
      userPayload: slot.userPayload,
      imageData: withVision && slot.imageData ? slot.imageData : null,
      docText: slot.docText || null,
      docFilename: slot.docFilename || null,
      temperature,
      maxTokens,
    });
    const r = await lmChatCompletion({ baseUrl, timeoutMs, retries, body });
    return parsePostResponse(extractChoiceText(r), slot.persona);
  };

  let parsed = { content: '', sentiment: null, inferenceChain: null, ingredients: null, highlights: null, thinking: null };
  let visionSucceeded = false;

  if (slot.imageData) {
    try {
      parsed = await runOnce(promptCfg.temperature, true);
      if (parsed.content) visionSucceeded = true;
    } catch { /* vision not supported */ }
  }

  if (!parsed.content) {
    const fallbackPayload = slot.imageData && slot.attachedAsset
      ? slot.userPayload + imageTextFallbackNote(slot.attachedAsset.filename || '')
      : slot.userPayload;
    const body = buildChatBody({
      model: slot._model,
      systemPrompt,
      userPayload: fallbackPayload,
      imageData: null,
      docText: slot.docText || null,
      docFilename: slot.docFilename || null,
      temperature: promptCfg.temperature,
      maxTokens,
    });
    parsed = parsePostResponse(extractChoiceText(await lmChatCompletion({ baseUrl, timeoutMs, retries, body })), slot.persona);
  }

  if (!parsed.content) {
    const body = buildChatBody({
      model: slot._model,
      systemPrompt,
      userPayload: slot.userPayload,
      imageData: null,
      docText: null,
      docFilename: null,
      temperature: 0.35,
      maxTokens,
    });
    parsed = parsePostResponse(extractChoiceText(await lmChatCompletion({ baseUrl, timeoutMs, retries, body })), slot.persona);
  }

  if (parsed.content && !postMetadataComplete(parsed) && !preferMetadataFallback) {
    try {
      const extra = await fetchPostMetadataOnly({
        slot,
        content: parsed.content,
        baseUrl,
        timeoutMs,
        retries,
      });
      if (extra.inferenceChain) parsed.inferenceChain = extra.inferenceChain;
      if (extra.ingredients) parsed.ingredients = extra.ingredients;
      if (extra.highlights) parsed.highlights = extra.highlights;
      if (extra.thinking) parsed.thinking = extra.thinking;
    } catch {
      /* deterministic chart fallback below */
    }
  }

  parsed = applyChartMetadataFallback(parsed, slot);

  const post = {
    persona: slot.persona,
    content: parsed.content,
    sentiment: parsed.sentiment,
    createdAt: new Date().toISOString(),
  };
  if (parsed.inferenceChain) post.inferenceChain = parsed.inferenceChain;
  if (parsed.ingredients) post.ingredients = parsed.ingredients;
  if (parsed.highlights) post.highlights = parsed.highlights;
  const thinking = parsed.thinking || synthesiseThinking(parsed, slot.persona);
  if (thinking) post.thinking = thinking;
  if (slot.attachedAsset) {
    post.attachedAsset = { ...slot.attachedAsset };
    if (slot.attachedAsset.kind === 'image') post.attachedAsset.visionAnalysed = visionSucceeded;
  }
  if (slot.textSliceType) post.textSliceType = slot.textSliceType;
  if (slot.chartType) post.chartType = slot.chartType;
  if (slot.leaderboard && slot.leaderboardContext) {
    const { board, standing, cloneHidden } = slot.leaderboardContext;
    const ratPromptCfg = SP.leaderboard_rationales ?? null;
    let rationales = null;
    if (ratPromptCfg) {
      try {
        const ratBody = buildChatBody({
          model: slot._model,
          systemPrompt: ratPromptCfg.system,
          userPayload: buildRationalesPayload(board, standing, cloneHidden),
          imageData: null,
          docText: null,
          docFilename: null,
          temperature: ratPromptCfg.temperature,
          maxTokens: ratPromptCfg.maxTokens,
        });
        const ratResp = await lmChatCompletion({ baseUrl, timeoutMs, retries, body: ratBody });
        rationales = parseRationalesResponse(extractChoiceText(ratResp));
      } catch {
        rationales = null;
      }
    }
    if (!rationales) rationales = fallbackRationales(board, standing, cloneHidden);
    slot.leaderboard.rationales = rationales;

    const climbPromptCfg = SP.leaderboard_climb_tip ?? null;
    let climbTip = null;
    if (climbPromptCfg) {
      try {
        const climbBody = buildChatBody({
          model: slot._model,
          systemPrompt: climbPromptCfg.system,
          userPayload: buildClimbTipPayload(board, standing),
          imageData: null,
          docText: null,
          docFilename: null,
          temperature: climbPromptCfg.temperature,
          maxTokens: climbPromptCfg.maxTokens,
        });
        const climbResp = await lmChatCompletion({ baseUrl, timeoutMs, retries, body: climbBody });
        climbTip = parseClimbTipResponse(extractChoiceText(climbResp));
      } catch {
        climbTip = null;
      }
    }
    if (!climbTip) climbTip = fallbackClimbTip(board, standing);
    slot.leaderboard.climbTip = climbTip;
  }
  if (slot.leaderboard) post.leaderboard = slot.leaderboard;

  return post;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string}      opts.baseUrl
 * @param {string}      opts.model
 * @param {string}      opts.userPayload         - JSON.stringify({user, profile})
 * @param {number}      opts.timeoutMs
 * @param {number}      opts.retries
 * @param {object|null} opts.assetAssignment      - { persona, asset: {kind, base64?, mime, text?, filename} }
 * @param {object|null} opts.prompts
 * @param {object|null} opts.dataJson             - parsed data.json for slice + chart injection
 * @param {object|null} opts.profile              - WebDiplome profile (for chart builders needing scores/storage)
 * @param {object[]}    opts.existingPosts         - current posts array (for recency guard)
 * @param {string|null} [opts.chartUploadDir]     - absolute dir to write chart PNG
 * @param {boolean}     [opts.skipLeaderboard]     - omit rank-change post (first setup)
 * @param {boolean}     [opts.preferMetadataFallback] - skip extra LM call for inferenceChain metadata
 * @param {function}    [opts.onEachPost]
 * @returns {Promise<(object|null)[]>} up to four entries [text, asset, chart, leaderboard]
 */
export async function generatePersonaPosts({
  baseUrl,
  model,
  userPayload,
  timeoutMs,
  retries,
  assetAssignment,
  prompts: promptsParam,
  dataJson,
  profile,
  existingPosts = [],
  chartUploadDir,
  skipLeaderboard = false,
  preferMetadataFallback = false,
  onEachPost,
}) {
  const SP = promptsParam?.slotPrompts ?? DEFAULT_SLOT_PROMPTS;

  const personaScores = profile?.personaScores ? normalizePersonaPercentTriplet(profile.personaScores) : null;
  const chartSlot = await buildChartSlot(dataJson, profile, userPayload, existingPosts, chartUploadDir, personaScores);
  const textSlot = buildTextSlot(dataJson, userPayload, existingPosts, SP, personaScores);
  const assetSlot = buildAssetSlot(userPayload, assetAssignment);
  const leaderboardSlot = skipLeaderboard
    ? null
    : buildLeaderboardSlot(dataJson, profile, userPayload, existingPosts, Date.now());

  const slots = [textSlot, assetSlot, chartSlot, leaderboardSlot]
    .map((s) => (s ? { ...s, _model: model } : null));

  const results = new Array(slots.length).fill(null);
  const slotRunOpts = { baseUrl, timeoutMs, retries, SP, preferMetadataFallback };

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (!slot) continue;
    try {
      const post = await runSlot(slot, slotRunOpts);
      if (!post?.content) continue;
      results[index] = post;
      if (typeof onEachPost === 'function') {
        try {
          await Promise.resolve(onEachPost(post, { slotIndex: index }));
        } catch (e) {
          console.error('[personaPostGenerator] onEachPost failed:', e?.message || e);
        }
      }
    } catch (err) {
      console.error(`[personaPostGenerator] slot ${slot.id} failed:`, err?.message || err);
    }
  }

  return results;
}

// ─── Profile bio (user summary) ─────────────────────────────────────────────

const USER_SUMMARY_MAX_LEN = 120;

function clampSummary(s) {
  let t = String(s || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/\.{2,}$|…$/u, '').trim();
  if (t.length <= USER_SUMMARY_MAX_LEN) return t;
  const cut = t.slice(0, USER_SUMMARY_MAX_LEN);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > USER_SUMMARY_MAX_LEN / 2 ? cut.slice(0, lastSpace) : cut)
    .replace(/[,;:]\s*$/, '')
    .trim();
}

function decodeJsonStringLiteral(s) {
  try {
    return JSON.parse(`"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  } catch {
    return String(s);
  }
}

function parseUserSummary(raw) {
  const text = (raw || '').trim();
  if (!text) return '';

  const tryParse = (slice) => {
    try {
      const obj = JSON.parse(slice);
      if (obj && typeof obj.description === 'string') return clampSummary(obj.description);
    } catch {
      /* ignore */
    }
    return null;
  };

  const direct = tryParse(text);
  if (direct != null) return direct;

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const inner = tryParse(text.slice(start, end + 1));
    if (inner != null) return inner;
  }

  const m = text.match(/"description"\s*:\s*"([\s\S]*?)"\s*[},]/i);
  if (m && m[1]) return clampSummary(decodeJsonStringLiteral(m[1]));

  return clampSummary(text);
}

/**
 * LM-generated profile bio (same prompt as Electron `generateUserSummary`).
 */
export async function generateUserSummary({
  baseUrl,
  model,
  userPayload,
  timeoutMs,
  retries,
  prompts,
}) {
  const cfg = prompts?.userSummary;
  if (!cfg?.system) throw new Error('userSummary prompt missing');
  const body = buildChatBody({
    model,
    systemPrompt: cfg.system,
    userPayload,
    temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 1,
    maxTokens: typeof cfg.maxTokens === 'number' ? cfg.maxTokens : 900,
  });
  const r = await lmChatCompletion({ baseUrl, timeoutMs, retries, body });
  return parseUserSummary(extractChoiceText(r));
}
