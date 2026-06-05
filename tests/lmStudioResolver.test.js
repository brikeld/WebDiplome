import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLmStudioEndpointCache,
  normalizeLmEndpoint,
  parseLmStudioEndpoints,
  probeLmStudioEndpoint,
  resolveLmStudioEndpoint,
} from '../server/lib/lmStudioResolver.js';

describe('lmStudioResolver', () => {
  afterEach(() => {
    clearLmStudioEndpointCache();
    vi.restoreAllMocks();
  });

  it('normalizes legacy single endpoint fields', () => {
    expect(
      normalizeLmEndpoint({ baseUrl: 'http://192.168.1.109:1234/v1', model: 'google/gemma-4-e2b' }),
    ).toEqual({
      name: 'http://192.168.1.109:1234',
      baseUrl: 'http://192.168.1.109:1234',
      model: 'google/gemma-4-e2b',
    });
  });

  it('parses ordered endpoints from json.endpoints', () => {
    const endpoints = parseLmStudioEndpoints({
      json: {
        endpoints: [
          { name: 'home', baseUrl: 'http://192.168.1.109:1234', model: 'google/gemma-4-e2b' },
          { name: 'away', baseUrl: 'http://10.0.0.5:1234', model: 'google/gemma-4-e4b' },
        ],
      },
      env: {},
    });
    expect(endpoints).toHaveLength(2);
    expect(endpoints[0].name).toBe('home');
    expect(endpoints[1].model).toBe('google/gemma-4-e4b');
  });

  it('skips incomplete endpoint rows', () => {
    const endpoints = parseLmStudioEndpoints({
      json: {
        endpoints: [
          { name: 'home', baseUrl: 'http://192.168.1.109:1234', model: 'google/gemma-4-e2b' },
          { name: 'away', baseUrl: '', model: '' },
        ],
      },
      env: {},
    });
    expect(endpoints).toHaveLength(1);
  });

  it('selects first reachable endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('192.168.1.109')) {
        return { ok: false, status: 503 };
      }
      if (String(url).includes('10.0.0.5')) {
        return { ok: true, status: 200 };
      }
      return { ok: false, status: 404 };
    }));

    const resolved = await resolveLmStudioEndpoint({
      json: {
        endpoints: [
          { name: 'home', baseUrl: 'http://192.168.1.109:1234', model: 'google/gemma-4-e2b' },
          { name: 'away', baseUrl: 'http://10.0.0.5:1234', model: 'google/gemma-4-e4b' },
        ],
      },
    });

    expect(resolved.name).toBe('away');
    expect(resolved.model).toBe('google/gemma-4-e4b');
    expect(resolved.index).toBe(1);
  });

  it('probeLmStudioEndpoint returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    await expect(probeLmStudioEndpoint('http://127.0.0.1:1234')).resolves.toBe(false);
  });
});
