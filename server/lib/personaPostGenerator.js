/**
 * LM Studio–compatible persona post generation (OpenAI-style /v1/chat/completions).
 * Produces exactly 3 posts: productivite, popularite, securite.
 * Logic is identical to the Electron app's PostGenerator.js.
 */

// First-person, casual, social-media voice — sounds like the user wrote it, not a coach.
const SYSTEM_PROMPTS = {
  productivite:
    'You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about something from their workflow or productivity. Sound like a human: a bit self-aware, natural rhythm, maybe slightly ironic or proud. No hashtags. No motivational-speaker tone.\nReturn ONLY valid JSON: {"content":"...","sentiment":"positive"|"negative"}. /no_think',
  popularite:
    'You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about their online presence or social life. Sound like a human: genuine, maybe a little playful or self-deprecating. No hashtags. No hype-machine tone.\nReturn ONLY valid JSON: {"content":"...","sentiment":"positive"|"negative"}. /no_think',
  securite:
    'You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) touching on their digital life or data habits. Sound like a human: honest, maybe a touch anxious or relieved. No hashtags. No security-textbook tone.\nReturn ONLY valid JSON: {"content":"...","sentiment":"positive"|"negative"}. /no_think',
};

const IMAGE_POST_PROMPT_EXTENSION =
  '\n\nAn image from the user\'s files is attached. Write the post as if the user is sharing or reacting to this image — describe what you see in a natural way, integrate it into the post voice. The post should feel like a genuine image caption or reaction.';

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
 */
export async function generatePersonaPosts({ baseUrl, model, userPayload, timeoutMs, retries, imageAssignment }) {
  const prompts = Object.entries(SYSTEM_PROMPTS);
  // Map persona name → index in prompts array
  const personaIndex = imageAssignment
    ? prompts.findIndex(([key]) => key === imageAssignment.persona)
    : -1;

  const runPersonaPost = async ([key, basePrompt], index) => {
    const wantsImage = personaIndex >= 0 && index === personaIndex;
    const assetImage = wantsImage ? imageAssignment.imageData : null;

    const runOnce = async (temperature, withVision) => {
      let systemPrompt = basePrompt;
      let imageData = null;

      if (wantsImage && assetImage) {
        if (withVision) {
          systemPrompt = basePrompt + IMAGE_POST_PROMPT_EXTENSION;
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
        maxTokens: 900,
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
        parsed = await runOnce(1, true);
        if (parsed.content) visionSucceeded = true;
      } catch {
        // Vision not supported by this model — will fall through to text fallback below.
      }
    }

    if (!parsed.content) {
      parsed = await runOnce(1, false);
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

  return await Promise.all(prompts.map((entry, i) => runPersonaPost(entry, i)));
}
