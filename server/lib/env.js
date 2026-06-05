function trimSlash(value, fallback = '') {
  const v = String(value || fallback).trim();
  return v.replace(/\/+$/, '');
}

export function buildServerConfig(env = globalThis.process?.env ?? {}) {
  const supabaseUrl = trimSlash(env.SUPABASE_URL);
  const supabaseAnonKey = String(env.SUPABASE_ANON_KEY || '').trim();
  const supabaseServiceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const aiWorkerToken = String(env.AI_WORKER_TOKEN || '').trim();
  const publicBaseUrl = trimSlash(env.PUBLIC_BASE_URL, 'http://localhost:3001');
  const hostedMode = Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey);

  return {
    hostedMode,
    publicBaseUrl,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    aiWorkerToken,
    lmStudioBaseUrl: trimSlash(env.LM_STUDIO_BASE_URL, 'http://127.0.0.1:1234'),
    lmStudioModel: String(env.LM_STUDIO_MODEL || 'google/gemma-4-e4b').trim(),
    lmStudioTimeoutMs: parseInt(env.LM_STUDIO_TIMEOUT_MS || '180000', 10),
    lmStudioRetries: parseInt(env.LM_STUDIO_RETRIES || '1', 10),
  };
}

export const serverConfig = buildServerConfig();
