/**
 * Slot-based persona post generation for the WebDiplome server.
 * Produces 5 posts (no chart rendering — falls back to text context).
 * Logic mirrors Diplome_/testCreationAcc/python/post_generator/PostGenerator.js.
 */

import {
  extractBrowserSlice,
  extractAppCategorySlice,
  extractWifiSlice,
  extractDownloadsSlice,
  formatBrowserSliceAsText,
  formatWifiSliceAsText,
  formatDownloadsAsText,
  formatAppCategoryAsText,
} from './dataSlices.js';
import { DEFAULT_SLOT_PROMPTS } from './prompts.js';

const SLOT_DEFS = [
  { id: 'text_browser',  persona: 'popularite',   promptKey: 'browser'  },
  { id: 'chart_apps',    persona: 'productivite', promptKey: 'chart'    },
  { id: 'image_photo',   persona: 'popularite',   promptKey: 'image'    },
  { id: 'text_security', persona: 'securite',     promptKey: null       },
  { id: 'doc_file',      persona: 'productivite', promptKey: 'document' },
];

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

// Build a prepared slot from data (no chart rendering, no local asset loading — caller passes asset via assetAssignment).
function buildTextSlot(def, dataJson, baseUserPayload) {
  switch (def.id) {
    case 'text_browser': {
      const slice = extractBrowserSlice(dataJson || {});
      const ctx = formatBrowserSliceAsText(slice);
      return { ...def, promptKey: 'browser', userPayload: ctx ? `${ctx}\n\n---\n${baseUserPayload}` : baseUserPayload, imageData: null, docText: null, docFilename: null, attachedAsset: null };
    }
    case 'chart_apps': {
      // No chart rendering on server — send text breakdown instead
      const appSlice = extractAppCategorySlice(dataJson || {});
      const ctx = formatAppCategoryAsText(appSlice);
      return { ...def, promptKey: 'chart', userPayload: ctx ? `${ctx}\n\n---\n${baseUserPayload}` : baseUserPayload, imageData: null, docText: null, docFilename: null, attachedAsset: null };
    }
    case 'text_security': {
      const wifiSlice = extractWifiSlice(dataJson || {});
      const dlSlice = extractDownloadsSlice(dataJson || {});
      const useWifi = wifiSlice.count >= 3 && (dlSlice.items.length < 2 || Math.random() > 0.4);
      const promptKey = useWifi ? 'wifi' : 'downloads';
      const ctx = useWifi ? formatWifiSliceAsText(wifiSlice) : formatDownloadsAsText(dlSlice);
      return { ...def, promptKey, userPayload: ctx ? `${ctx}\n\n---\n${baseUserPayload}` : baseUserPayload, imageData: null, docText: null, docFilename: null, attachedAsset: null };
    }
    default:
      return { ...def, promptKey: def.promptKey || 'browser', userPayload: baseUserPayload, imageData: null, docText: null, docFilename: null, attachedAsset: null };
  }
}

/**
 * @param {object} opts
 * @param {string}      opts.baseUrl
 * @param {string}      opts.model
 * @param {string}      opts.userPayload       - JSON.stringify({user, profile})
 * @param {number}      opts.timeoutMs
 * @param {number}      opts.retries
 * @param {object|null} opts.assetAssignment   - { persona, asset: {kind, base64?, mime, text?, filename} }
 * @param {object|null} opts.prompts
 * @param {object|null} opts.dataJson          - parsed data.json for slice injection
 * @param {function(object, { slotIndex: number }): void} [opts.onEachPost]
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
  onEachPost,
}) {
  const SP = promptsParam?.slotPrompts ?? DEFAULT_SLOT_PROMPTS;

  // Build text-only slots first (image/doc will be overridden by assetAssignment)
  const slots = SLOT_DEFS.map(def => {
    if (def.id === 'image_photo' || def.id === 'doc_file') {
      return { ...def, promptKey: def.promptKey, userPayload, imageData: null, docText: null, docFilename: null, attachedAsset: null };
    }
    return buildTextSlot(def, dataJson, userPayload);
  });

  // Apply assetAssignment to the matching slot
  if (assetAssignment) {
    const targetSlot = assetAssignment.asset?.kind === 'document' ? 'doc_file' : 'image_photo';
    const idx = slots.findIndex(s => s.id === targetSlot);
    if (idx !== -1) {
      const asset = assetAssignment.asset;
      if (asset.kind === 'image') {
        slots[idx].imageData = { base64: asset.base64, mime: asset.mime };
      } else {
        slots[idx].docText = asset.text;
        slots[idx].docFilename = asset.filename;
      }
      slots[idx].attachedAsset = {
        kind: asset.kind,
        filename: asset.filename,
        relativePath: null,
        url: null,
        mime: asset.mime ?? 'application/octet-stream',
      };
    }
  }

  const runSlotPost = async (slot) => {
    const promptCfg = SP[slot.promptKey] ?? DEFAULT_SLOT_PROMPTS.browser;

    const runOnce = async (temperature, withVision) => {
      const body = buildChatBody({
        model,
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
      const body = buildChatBody({ model, systemPrompt: promptCfg.system, userPayload: fallbackPayload, imageData: null, docText: slot.docText || null, docFilename: slot.docFilename || null, temperature: promptCfg.temperature, maxTokens: promptCfg.maxTokens });
      parsed = parsePostWithSentiment(extractChoiceText(await lmChatCompletion({ baseUrl, timeoutMs, retries, body })), slot.persona);
    }

    if (!parsed.content) {
      const body = buildChatBody({ model, systemPrompt: promptCfg.system, userPayload: slot.userPayload, imageData: null, docText: null, docFilename: null, temperature: 0.35, maxTokens: promptCfg.maxTokens });
      parsed = parsePostWithSentiment(extractChoiceText(await lmChatCompletion({ baseUrl, timeoutMs, retries, body })), slot.persona);
    }

    const post = { persona: slot.persona, content: parsed.content, sentiment: parsed.sentiment, createdAt: new Date().toISOString() };
    if (slot.attachedAsset) {
      post.attachedAsset = { ...slot.attachedAsset };
      if (slot.attachedAsset.kind === 'image') post.attachedAsset.visionAnalysed = visionSucceeded;
    }
    return post;
  };

  const n = slots.length;
  const slotResults = new Array(n).fill(null);

  await Promise.all(
    slots.map((slot, index) =>
      runSlotPost(slot)
        .catch((err) => {
          console.error(`[personaPostGenerator] slot ${slot.id} failed:`, err?.message || err);
          return null;
        })
        .then(async (post) => {
          if (!post || !post.content) return null;
          slotResults[index] = post;
          if (typeof onEachPost === 'function') {
            try {
              await Promise.resolve(onEachPost(post, { slotIndex: index }));
            } catch (e) {
              console.error('[personaPostGenerator] onEachPost failed:', e?.message || e);
            }
          }
          return post;
        })
    )
  );

  return slotResults.filter(Boolean);
}
