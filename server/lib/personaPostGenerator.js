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
import { DEFAULT_SLOT_PROMPTS } from './prompts.js';

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

function buildChatBody({ model, systemPrompt, userPayload, imageData, docText, docFilename, maxTokens = 900, temperature = 0.7 }) {
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
  return {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature,
    max_tokens: maxTokens,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  };
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

function parsePostWithSentiment(raw, fallbackPersona) {
  const text = (raw || '').trim();
  if (!text) return { content: '', sentiment: null };
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') {
      const content = typeof obj.content === 'string' ? obj.content.trim() : '';
      const sentiment = normalizeSentiment(obj.sentiment);
      if (content) return { content, sentiment };
    }
  } catch { /* fall through */ }
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      if (obj && typeof obj === 'object') {
        const content = typeof obj.content === 'string' ? obj.content.trim() : '';
        const sentiment = normalizeSentiment(obj.sentiment);
        if (content) return { content, sentiment };
      }
    } catch { /* fall through */ }
  }
  const inferred = fallbackPersona === 'securite' ? 'negative' : 'positive';
  return { content: text, sentiment: inferred };
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
  if (asset.kind === 'image') {
    slot.imageData = { base64: asset.base64, mime: asset.mime };
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
    relativePath: null,
    url: null,
    mime: asset.mime ?? 'application/octet-stream',
  };

  return slot;
}

// ─── Slot runner ───────────────────────────────────────────────────────────

async function runSlot(slot, { baseUrl, timeoutMs, retries, SP }) {
  const promptCfg = SP[slot.promptKey] ?? DEFAULT_SLOT_PROMPTS.browser;

  const runOnce = async (temperature, withVision) => {
    const body = buildChatBody({
      model: slot._model,
      systemPrompt: promptCfg.system,
      userPayload: slot.userPayload,
      imageData: withVision && slot.imageData ? slot.imageData : null,
      docText: slot.docText || null,
      docFilename: slot.docFilename || null,
      temperature,
      maxTokens: promptCfg.maxTokens,
    });
    const r = await lmChatCompletion({ baseUrl, timeoutMs, retries, body });
    return parsePostWithSentiment(extractChoiceText(r), slot.persona);
  };

  let parsed = { content: '', sentiment: null };
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
      systemPrompt: promptCfg.system,
      userPayload: fallbackPayload,
      imageData: null,
      docText: slot.docText || null,
      docFilename: slot.docFilename || null,
      temperature: promptCfg.temperature,
      maxTokens: promptCfg.maxTokens,
    });
    parsed = parsePostWithSentiment(extractChoiceText(await lmChatCompletion({ baseUrl, timeoutMs, retries, body })), slot.persona);
  }

  if (!parsed.content) {
    const body = buildChatBody({
      model: slot._model,
      systemPrompt: promptCfg.system,
      userPayload: slot.userPayload,
      imageData: null,
      docText: null,
      docFilename: null,
      temperature: 0.35,
      maxTokens: promptCfg.maxTokens,
    });
    parsed = parsePostWithSentiment(extractChoiceText(await lmChatCompletion({ baseUrl, timeoutMs, retries, body })), slot.persona);
  }

  const post = {
    persona: slot.persona,
    content: parsed.content,
    sentiment: parsed.sentiment,
    createdAt: new Date().toISOString(),
  };
  if (slot.attachedAsset) {
    post.attachedAsset = { ...slot.attachedAsset };
    if (slot.attachedAsset.kind === 'image') post.attachedAsset.visionAnalysed = visionSucceeded;
  }
  if (slot.textSliceType) post.textSliceType = slot.textSliceType;
  if (slot.chartType) post.chartType = slot.chartType;

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
 * @param {function}    [opts.onEachPost]
 * @returns {Promise<(object|null)[]>} three entries [text, asset, chart]; null = slot failed
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
  onEachPost,
}) {
  const SP = promptsParam?.slotPrompts ?? DEFAULT_SLOT_PROMPTS;

  const personaScores = profile?.personaScores ?? null;
  const [chartSlot, textSlot] = await Promise.all([
    buildChartSlot(dataJson, profile, userPayload, existingPosts, chartUploadDir, personaScores),
    Promise.resolve(buildTextSlot(dataJson, userPayload, existingPosts, SP, personaScores)),
  ]);
  const assetSlot = buildAssetSlot(userPayload, assetAssignment);

  const slots = [textSlot, assetSlot, chartSlot].map(s => ({ ...s, _model: model }));

  const results = new Array(slots.length).fill(null);

  await Promise.all(
    slots.map((slot, index) =>
      runSlot(slot, { baseUrl, timeoutMs, retries, SP })
        .catch((err) => {
          console.error(`[personaPostGenerator] slot ${slot.id} failed:`, err?.message || err);
          return null;
        })
        .then(async (post) => {
          if (!post || !post.content) return null;
          results[index] = post;
          if (typeof onEachPost === 'function') {
            try {
              await Promise.resolve(onEachPost(post, { slotIndex: index }));
            } catch (e) {
              console.error('[personaPostGenerator] onEachPost failed:', e?.message || e);
            }
          }
          return post;
        }),
    ),
  );

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
