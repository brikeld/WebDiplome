/**
 * LM Studio–compatible persona post generation (OpenAI-style /v1/chat/completions).
 * Produces exactly 3 posts: productivite, popularite, securite.
 * Logic is identical to the Electron app's PostGenerator.js.
 */

// Minimal fallback used only when no prompts object is supplied (defensive).
const FALLBACK_PROMPTS = {
  personaPosts: {
    productivite: { system: '', temperature: 0.7, maxTokens: 900 },
    popularite: { system: '', temperature: 0.7, maxTokens: 900 },
    securite: { system: '', temperature: 0.7, maxTokens: 900 },
  },
  imageExtension: '',
  documentExtension: '',
};

function imageTextFallbackNote(filename) {
  return `\n\nFor context, the user recently had a file named "${filename}" in their recent images — you may reference it naturally in the post.`;
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    const text = await resp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (!resp.ok) {
      const msg = json?.error?.message || json?.error || text || `HTTP ${resp.status}`;
      throw new Error(msg);
    }
    return json ?? {};
  } finally {
    clearTimeout(id);
  }
}

function buildChatBody({ model, systemPrompt, userPayload, imageData, maxTokens = 900, temperature = 0.7 }) {
  const userContent = imageData
    ? [
        { type: 'text', text: userPayload },
        {
          type: 'image_url',
          image_url: { url: `data:${imageData.mime};base64,${imageData.base64}` },
        },
      ]
    : userPayload;

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
      return await fetchJsonWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        timeoutMs,
      );
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (body && body.response_format && /response_format|json_object|not supported|unsupported/i.test(msg)) {
        try {
          const { response_format, ...rest } = body;
          return await fetchJsonWithTimeout(
            url,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(rest),
            },
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

function extractChoiceText(resp) {
  const msg = resp?.choices?.[0]?.message || {};
  return (
    (msg.content && msg.content.trim()) ||
    (msg.reasoning_content && msg.reasoning_content.trim()) ||
    ''
  );
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
  } catch {
    // fall through
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try {
      const obj = JSON.parse(slice);
      if (obj && typeof obj === 'object') {
        const content = typeof obj.content === 'string' ? obj.content.trim() : '';
        const sentiment = normalizeSentiment(obj.sentiment);
        if (content) return { content, sentiment };
      }
    } catch {
      // fall through
    }
  }

  const inferred =
    fallbackPersona === 'securite' ? 'negative' :
    fallbackPersona === 'productivite' ? 'positive' :
    fallbackPersona === 'popularite' ? 'positive' :
    null;
  return { content: text, sentiment: inferred };
}

/**
 * Generates 3 persona posts using the same logic as the Electron app's PostGenerator.js.
 *
 * @param {object} opts
 * @param {string} opts.baseUrl       - LM Studio base URL (e.g. http://192.168.1.109:1234)
 * @param {string} opts.model         - model name
 * @param {string} opts.userPayload   - JSON.stringify(profile) — full profile data sent as the user message
 * @param {number} opts.timeoutMs     - per-request timeout in ms
 * @param {number} opts.retries       - number of retries on failure
 * @param {object|null} opts.imageAssignment
 *   - { persona: 'productivite'|'popularite'|'securite', imageData: { base64, mime, filename } }
 *   - null if no image for this generation
 * @param {object|null} opts.prompts  - loaded prompts object (from loadPrompts); falls back to FALLBACK_PROMPTS
 */
export async function generatePersonaPosts({ baseUrl, model, userPayload, timeoutMs, retries, imageAssignment, prompts: promptsParam }) {
  const prompts = promptsParam ?? FALLBACK_PROMPTS;
  const personaEntries = Object.entries(prompts.personaPosts);
  // Map persona name → index in personaEntries array
  const personaIndex = imageAssignment
    ? personaEntries.findIndex(([key]) => key === imageAssignment.persona)
    : -1;

  const runPersonaPost = async ([key, personaCfg], index) => {
    const basePrompt = personaCfg.system;
    const wantsImage = personaIndex >= 0 && index === personaIndex;
    const assetImage = wantsImage ? imageAssignment.imageData : null;

    const runOnce = async (temperature, withVision) => {
      let systemPrompt = basePrompt;
      let imageData = null;

      if (wantsImage && assetImage) {
        if (withVision) {
          systemPrompt = basePrompt + prompts.imageExtension;
          imageData = assetImage;
        } else {
          systemPrompt = basePrompt + imageTextFallbackNote(assetImage.filename);
        }
      }

      const body = buildChatBody({
        model,
        systemPrompt,
        userPayload,
        imageData,
        temperature,
        maxTokens: personaCfg.maxTokens,
      });
      const r = await lmChatCompletion({ baseUrl, timeoutMs, retries, body });
      const raw = extractChoiceText(r);
      return parsePostWithSentiment(raw, key);
    };

    let parsed = { content: '', sentiment: null };
    let visionSucceeded = false;

    if (wantsImage && assetImage) {
      // Try vision first; fall back to text if model doesn't support it.
      try {
        parsed = await runOnce(personaCfg.temperature, true);
        if (parsed.content) visionSucceeded = true;
      } catch {
        // Vision not supported by this model — will fall through to text fallback below.
      }
    }

    if (!parsed.content) {
      parsed = await runOnce(personaCfg.temperature, false);
    }
    if (!parsed.content) {
      parsed = await runOnce(0.35, false);
    }

    const post = {
      persona: key,
      content: parsed.content,
      sentiment: parsed.sentiment,
      createdAt: new Date().toISOString(),
    };

    // Always mark the image as attached when this post was paired with an asset,
    // regardless of whether vision was used (asset is still conceptually linked).
    if (wantsImage && assetImage) {
      post.attachedImage = {
        filename: assetImage.filename,
        visionAnalysed: visionSucceeded,
      };
    }

    return post;
  };

  return await Promise.all(personaEntries.map((entry, i) => runPersonaPost(entry, i)));
}
