import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AI worker Node config', () => {
  const source = readFileSync(new URL('../worker/ai-worker.js', import.meta.url), 'utf8');

  it('does not read browser URL state in the Node worker entrypoint', () => {
    expect(source).not.toContain('window.location');
    expect(source).not.toContain('url_params');
    expect(source).toContain('process.env.LM_STUDIO_BASE_URL');
    expect(source).toContain('process.env.LM_STUDIO_MODEL');
  });
});
