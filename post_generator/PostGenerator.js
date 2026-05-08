/**
 * LM Studio generation utilities (OpenAI-compatible HTTP API).
 * Used by the Electron main process via IPC handlers in `main.js`.
 */

const fs = require("fs");
const path = require("path");

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
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

// First-person, casual, social-media voice — sounds like the user wrote it, not a coach.
const SYSTEM_PROMPTS = {
  productivite:
    "You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about something from their workflow or productivity. Sound like a human: a bit self-aware, natural rhythm, maybe slightly ironic or proud. No hashtags. No motivational-speaker tone.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
  popularite:
    "You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about their online presence or social life. Sound like a human: genuine, maybe a little playful or self-deprecating. No hashtags. No hype-machine tone.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
  securite:
    "You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) touching on their digital life or data habits. Sound like a human: honest, maybe a touch anxious or relieved. No hashtags. No security-textbook tone.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
};

// Extension appended to the prompt when the post is anchored to a specific image.
const IMAGE_POST_PROMPT_EXTENSION =
  "\n\nAn image from the user's files is attached. Write the post as if the user is sharing or reacting to this image — describe what you see in a natural way, integrate it into the post voice. The post should feel like a genuine image caption or reaction.";

// Text-only fallback when vision fails — gives the model the filename so it can still reference the asset.
function imageTextFallbackNote(filename) {
  return `\n\nFor context, the user recently had a file named "${filename}" in their recent images — you may reference it naturally in the post.`;
}

const SYSTEM_PROMPT_USER_SUMMARY =
  "You profile digital citizens from system data. Read the JSON (user + profile). Write ONE short introduction in French (max 140 characters) describing observable digital habits/tools — factual, no moral judgment.\nReturn ONLY valid JSON: {\"description\":\"...\"}. No markdown, no line breaks in the string. /no_think";

const USER_SUMMARY_MAX_LEN = 140;

function clampSummary(s) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= USER_SUMMARY_MAX_LEN) return t;
  // Cut at last word boundary to avoid mid-word truncation.
  const cut = t.slice(0, USER_SUMMARY_MAX_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > USER_SUMMARY_MAX_LEN / 2 ? cut.slice(0, lastSpace) + "…" : cut + "…";
}

function decodeJsonStringLiteral(s) {
  // Decodes common JSON string escapes safely.
  try {
    return JSON.parse(`"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return String(s);
  }
}

function parseUserSummary(raw) {
  const text = (raw || "").trim();
  if (!text) return "";

  const tryParse = (slice) => {
    try {
      const obj = JSON.parse(slice);
      if (obj && typeof obj.description === "string") return clampSummary(obj.description);
    } catch {
      /* ignore */
    }
    return null;
  };

  const direct = tryParse(text);
  if (direct != null) return direct;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const inner = tryParse(text.slice(start, end + 1));
    if (inner != null) return inner;
  }

  // Best-effort extraction if model returned JSON-ish text we couldn't parse.
  // Example: {"description":"..."} but with minor formatting issues.
  const m = text.match(/"description"\s*:\s*"([\s\S]*?)"\s*[},]/i);
  if (m && m[1]) return clampSummary(decodeJsonStringLiteral(m[1]));

  return clampSummary(text);
}

function parsePostWithSentiment(raw, fallbackPersona) {
  const text = (raw || "").trim();
  if (!text) return { content: "", sentiment: null };

  const normalizeSentiment = (s) => {
    const v = String(s || "").trim().toLowerCase();
    return v === "positive" || v === "negative" ? v : null;
  };

  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object") {
      const content = typeof obj.content === "string" ? obj.content.trim() : "";
      const sentiment = normalizeSentiment(obj.sentiment);
      if (content) return { content, sentiment };
    }
  } catch {
    // fall through
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try {
      const obj = JSON.parse(slice);
      if (obj && typeof obj === "object") {
        const content = typeof obj.content === "string" ? obj.content.trim() : "";
        const sentiment = normalizeSentiment(obj.sentiment);
        if (content) return { content, sentiment };
      }
    } catch {
      // fall through
    }
  }

  const inferred =
    fallbackPersona === "securite" ? "negative" :
    fallbackPersona === "productivite" ? "positive" :
    fallbackPersona === "popularite" ? "positive" :
    null;
  return { content: text, sentiment: inferred };
}

function normalizePostsFilePayload(raw) {
  if (raw == null) return { posts: [], userDescription: "" };
  if (Array.isArray(raw)) return { posts: raw, userDescription: "" };
  if (typeof raw === "object") {
    return {
      posts: Array.isArray(raw.posts) ? raw.posts : [],
      userDescription:
        typeof raw.userDescription === "string" ? raw.userDescription : "",
    };
  }
  return { posts: [], userDescription: "" };
}

function buildChatBody({ model, systemPrompt, userPayload, imageData, maxTokens = 900, temperature = 0.7 }) {
  const userContent = imageData
    ? [
        { type: "text", text: userPayload },
        {
          type: "image_url",
          image_url: { url: `data:${imageData.mime};base64,${imageData.base64}` },
        },
      ]
    : userPayload;

  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature,
    max_tokens: maxTokens,
    enable_thinking: false,
    response_format: { type: "json_object" },
  };
}

async function lmChatCompletion({ baseUrl, timeoutMs, retries, body }) {
  const url = `${String(baseUrl).replace(/\/$/, "")}/v1/chat/completions`;
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchJsonWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        timeoutMs
      );
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (body && body.response_format && /response_format|json_object|not supported|unsupported/i.test(msg)) {
        try {
          const { response_format, ...rest } = body;
          return await fetchJsonWithTimeout(
            url,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(rest),
            },
            timeoutMs
          );
        } catch (e2) {
          lastErr = e2;
          continue;
        }
      }
      lastErr = e;
    }
  }
  throw lastErr || new Error("LM Studio request failed");
}

function extractChoiceText(resp) {
  const msg = resp?.choices?.[0]?.message || {};
  return (
    (msg.content && msg.content.trim()) ||
    (msg.reasoning_content && msg.reasoning_content.trim()) ||
    ""
  );
}

/**
 * Picks a random image from assets/recent_images or assets/screenshots (excluding profile pic).
 * Returns { filename, relativePath, base64, mime } or null if none found.
 */
function pickRandomAssetImage(dataDir) {
  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const candidates = [];

  const recentDir = path.join(dataDir, "assets", "recent_images");
  if (fs.existsSync(recentDir)) {
    for (const f of fs.readdirSync(recentDir)) {
      if (imageExts.has(path.extname(f).toLowerCase()) && f !== "profile.jpg") {
        candidates.push({
          filename: f,
          fullPath: path.join(recentDir, f),
          relativePath: `assets/recent_images/${f}`,
        });
      }
    }
  }

  const screenshotsDir = path.join(dataDir, "assets", "screenshots");
  if (fs.existsSync(screenshotsDir)) {
    for (const f of fs.readdirSync(screenshotsDir)) {
      if (imageExts.has(path.extname(f).toLowerCase())) {
        candidates.push({
          filename: f,
          fullPath: path.join(screenshotsDir, f),
          relativePath: `assets/screenshots/${f}`,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  try {
    const buf = fs.readFileSync(pick.fullPath);
    if (buf.length === 0) return null;
    const ext = path.extname(pick.filename).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" :
      "image/jpeg";
    return { ...pick, base64: buf.toString("base64"), mime };
  } catch {
    return null;
  }
}

async function generateUserSummary({ baseUrl, model, userPayload, timeoutMs, retries }) {
  const body = buildChatBody({
    model,
    systemPrompt: SYSTEM_PROMPT_USER_SUMMARY,
    userPayload,
    temperature: 0.55,
    maxTokens: 900,
  });
  const r = await lmChatCompletion({ baseUrl, timeoutMs, retries, body });
  const raw = extractChoiceText(r);
  return parseUserSummary(raw);
}

/**
 * Generates 3 persona posts. One of the three (random) is anchored to an image
 * from the user's assets: the model receives the image via vision API and the
 * post JSON stores an `attachedImage` reference.
 *
 * If the model doesn't support vision, falls back to a text prompt that still
 * references the image filename so the post remains connected to the asset.
 */
async function generatePersonaPosts({ baseUrl, model, userPayload, timeoutMs, retries, dataDir }) {
  const prompts = Object.entries(SYSTEM_PROMPTS);

  // Pick which of the 3 posts gets the image treatment this run.
  const imagePersonaIndex = Math.floor(Math.random() * prompts.length);
  const assetImage = dataDir ? pickRandomAssetImage(dataDir) : null;

  const runPersonaPost = async ([key, basePrompt], index) => {
    const wantsImage = assetImage != null && index === imagePersonaIndex;

    const runOnce = async (temperature, withVision) => {
      let systemPrompt = basePrompt;
      let imageData = null;

      if (wantsImage) {
        if (withVision) {
          systemPrompt = basePrompt + IMAGE_POST_PROMPT_EXTENSION;
          imageData = assetImage;
        } else {
          // Vision failed or skipped — include filename in text prompt.
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

    let parsed = { content: "", sentiment: null };
    let visionSucceeded = false;

    if (wantsImage) {
      // Try vision first.
      try {
        parsed = await runOnce(1, true);
        if (parsed.content) visionSucceeded = true;
      } catch {
        // Vision not supported by this model — fall through to text fallback.
      }
    }

    if (!parsed.content) {
      // Text-only path (either not an image post, vision failed, or empty result).
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

    // Always attach the image reference if this post was paired with an asset,
    // regardless of whether vision was used (the asset is still conceptually attached).
    if (wantsImage) {
      post.attachedImage = {
        filename: assetImage.filename,
        relativePath: assetImage.relativePath,
        visionAnalysed: visionSucceeded,
      };
    }

    return post;
  };

  return await Promise.all(prompts.map((entry, i) => runPersonaPost(entry, i)));
}

module.exports = {
  SYSTEM_PROMPTS,
  SYSTEM_PROMPT_USER_SUMMARY,
  normalizePostsFilePayload,
  generateUserSummary,
  generatePersonaPosts,
};
