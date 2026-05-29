import { describe, expect, it } from 'vitest';
import { buildServerConfig } from '../server/lib/env.js';

describe('buildServerConfig', () => {
  it('keeps hosted mode disabled when Supabase keys are missing', () => {
    const cfg = buildServerConfig({});
    expect(cfg.hostedMode).toBe(false);
  });

  it('enables hosted mode only when all Supabase server keys exist', () => {
    const cfg = buildServerConfig({
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      AI_WORKER_TOKEN: 'worker',
    });
    expect(cfg.hostedMode).toBe(true);
    expect(cfg.supabaseUrl).toBe('https://demo.supabase.co');
    expect(cfg.publicBaseUrl).toBe('http://localhost:3001');
  });

  it('normalizes trailing slashes', () => {
    const cfg = buildServerConfig({
      PUBLIC_BASE_URL: 'https://api.example.com/',
      SUPABASE_URL: 'https://demo.supabase.co/',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    });
    expect(cfg.publicBaseUrl).toBe('https://api.example.com');
    expect(cfg.supabaseUrl).toBe('https://demo.supabase.co');
  });
});
