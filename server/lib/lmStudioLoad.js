/**
 * Pin LM Studio context length before /v1/chat/completions.
 * JIT loading via chat/completions ignores GUI "131072" settings and defaults to ~4096.
 * @see https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1463
 */

let loadedSignature = null;

function resolveContextLength(override) {
  if (override != null && Number.isFinite(Number(override)) && Number(override) > 0) {
    return Number(override);
  }
  const env = process.env.LM_STUDIO_CONTEXT_LENGTH;
  if (env != null && String(env).trim() !== '') {
    const n = parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 131072;
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || text || `HTTP ${res.status}`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return json ?? {};
  } finally {
    clearTimeout(id);
  }
}

/**
 * Load (or confirm) the model at the requested context length via LM Studio v1 API.
 * Skips reload when the same model+context was loaded successfully in this process.
 */
export async function ensureLmModelLoaded({
  baseUrl,
  model,
  contextLength,
  timeoutMs = 120000,
} = {}) {
  const base = String(baseUrl || process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');
  const modelId = String(model || process.env.LM_STUDIO_MODEL || '').trim();
  if (!modelId) throw new Error('LM_STUDIO_MODEL is required');

  const ctx = resolveContextLength(contextLength);
  const signature = `${base}|${modelId}|${ctx}`;
  if (loadedSignature === signature) return { model: modelId, contextLength: ctx, cached: true };

  const body = {
    model: modelId,
    context_length: ctx,
    echo_load_config: true,
  };

  const url = `${base}/api/v1/models/load`;
  const json = await fetchJsonWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  const loadedCtx = json?.load_config?.context_length ?? ctx;
  loadedSignature = `${base}|${modelId}|${loadedCtx}`;
  console.log(`[lm-studio] loaded ${modelId} context_length=${loadedCtx}`);
  return { model: modelId, contextLength: loadedCtx, cached: false, response: json };
}

/** Reset cache (tests or after LM Studio restart). */
export function resetLmModelLoadCache() {
  loadedSignature = null;
}
