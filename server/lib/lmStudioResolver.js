/**
 * Resolve LM Studio baseUrl + model from an ordered endpoint list.
 * Probes /v1/models and uses the first reachable host (primary → fallbacks).
 */

const DEFAULT_PROBE_MS = 3000;
const DEFAULT_CACHE_TTL_MS = 60_000;

export function normalizeLmEndpoint(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const rawBase = String(entry.baseUrl || entry.base_url || '').trim();
  const model = String(entry.model || '').trim();
  if (!rawBase || !model) return null;
  const withoutV1 = rawBase.replace(/\/+$/, '');
  const baseUrl = withoutV1.endsWith('/v1') ? withoutV1.slice(0, -3) : withoutV1;
  return {
    name: String(entry.name || baseUrl).trim() || baseUrl,
    baseUrl,
    model,
  };
}

function parseEndpointsFromJsonArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeLmEndpoint).filter(Boolean);
}

/**
 * Build ordered endpoints from env + JSON config.
 * Priority: LM_STUDIO_ENDPOINTS env → json.endpoints → legacy baseUrl/model → defaults.
 */
export function parseLmStudioEndpoints({ json = {}, env = process.env } = {}) {
  const fromEnvJson = env?.LM_STUDIO_ENDPOINTS;
  if (fromEnvJson) {
    try {
      const parsed = parseEndpointsFromJsonArray(JSON.parse(fromEnvJson));
      if (parsed.length) return parsed;
    } catch {
      /* ignore malformed env */
    }
  }

  const fromFile = parseEndpointsFromJsonArray(json?.endpoints);
  if (fromFile.length) return fromFile;

  const legacy = normalizeLmEndpoint({
    name: 'primary',
    baseUrl: env?.LM_STUDIO_BASE_URL || json?.baseUrl || json?.base_url,
    model: env?.LM_STUDIO_MODEL || json?.model,
  });
  if (legacy) return [legacy];

  return [
    {
      name: 'default',
      baseUrl: 'http://192.168.1.109:1234',
      model: 'google/gemma-4-e2b',
    },
  ];
}

export async function probeLmStudioEndpoint(baseUrl, { timeoutMs = DEFAULT_PROBE_MS } = {}) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) return false;
  const url = `${base}/v1/models`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let cachedSelection = null;
let cachedAt = 0;

export function clearLmStudioEndpointCache() {
  cachedSelection = null;
  cachedAt = 0;
}

/**
 * @returns {Promise<{ name: string, baseUrl: string, model: string, index: number, cached: boolean, endpoints: object[] }>}
 */
export async function resolveLmStudioEndpoint(
  sources,
  {
    probeTimeoutMs = DEFAULT_PROBE_MS,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    forceRefresh = false,
    skipProbe = false,
  } = {},
) {
  const endpoints = parseLmStudioEndpoints(sources);
  if (!endpoints.length) {
    throw new Error('No LM Studio endpoints configured');
  }

  if (
    !forceRefresh
    && cachedSelection
    && Date.now() - cachedAt < cacheTtlMs
  ) {
    return { ...cachedSelection, cached: true, endpoints };
  }

  const tried = [];
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    const reachable = skipProbe || await probeLmStudioEndpoint(endpoint.baseUrl, { timeoutMs: probeTimeoutMs });
    tried.push(endpoint.name);
    if (reachable) {
      const selection = { ...endpoint, index, cached: false };
      cachedSelection = selection;
      cachedAt = Date.now();
      return { ...selection, endpoints };
    }
  }

  throw new Error(
    `LM Studio unreachable (${tried.join(' → ')}). Start LM Studio on the primary PC or ensure a fallback is online.`,
  );
}

export async function resolveLmStudioConfig(sources, options = {}) {
  const resolved = await resolveLmStudioEndpoint(sources, options);
  return {
    baseUrl: resolved.baseUrl,
    model: resolved.model,
    endpointName: resolved.name,
    endpointIndex: resolved.index,
    cached: resolved.cached,
  };
}
