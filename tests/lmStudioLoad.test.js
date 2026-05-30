import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  ensureLmModelLoaded,
  resetLmModelLoadCache,
} from '../server/lib/lmStudioLoad.js';

describe('ensureLmModelLoaded', () => {
  beforeEach(() => {
    resetLmModelLoadCache();
    vi.unstubAllGlobals();
    delete process.env.LM_STUDIO_CONTEXT_LENGTH;
  });

  it('calls /api/v1/models/load with context_length from env', async () => {
    process.env.LM_STUDIO_CONTEXT_LENGTH = '65536';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        status: 'loaded',
        load_config: { context_length: 65536 },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureLmModelLoaded({
      baseUrl: 'http://127.0.0.1:1234',
      model: 'google/gemma-4-e2b',
    });

    expect(result.contextLength).toBe(65536);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('google/gemma-4-e2b');
    expect(body.context_length).toBe(65536);
  });

  it('skips second load for same model and context', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        status: 'loaded',
        load_config: { context_length: 131072 },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await ensureLmModelLoaded({ baseUrl: 'http://127.0.0.1:1234', model: 'test-model' });
    const second = await ensureLmModelLoaded({ baseUrl: 'http://127.0.0.1:1234', model: 'test-model' });

    expect(second.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
