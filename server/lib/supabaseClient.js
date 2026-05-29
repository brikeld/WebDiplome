import { createClient } from '@supabase/supabase-js';
import { serverConfig } from './env.js';

export function createSupabaseClients(config = serverConfig) {
  if (!config.hostedMode) {
    return { anon: null, service: null };
  }

  const baseOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  };

  return {
    anon: createClient(config.supabaseUrl, config.supabaseAnonKey, baseOptions),
    service: createClient(config.supabaseUrl, config.supabaseServiceRoleKey, baseOptions),
  };
}

export const supabaseClients = createSupabaseClients();
