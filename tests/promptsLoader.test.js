import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { loadPrompts, DEFAULT_PROMPTS } from '../server/lib/prompts.js';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompts-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('loadPrompts', () => {
  it('returns DEFAULT_PROMPTS when prompts.json is missing', async () => {
    const p = await loadPrompts(tmpDir);
    expect(p).toEqual(DEFAULT_PROMPTS);
  });

  it('returns DEFAULT_PROMPTS when prompts.json is malformed JSON', async () => {
    await fs.writeFile(path.join(tmpDir, 'prompts.json'), '{ not json', 'utf8');
    const p = await loadPrompts(tmpDir);
    expect(p).toEqual(DEFAULT_PROMPTS);
  });

  it('merges partial overrides per-key', async () => {
    const partial = {
      personaPosts: {
        productivite: { system: 'override-prod', temperature: 0.9, maxTokens: 100 },
      },
    };
    await fs.writeFile(path.join(tmpDir, 'prompts.json'), JSON.stringify(partial), 'utf8');
    const p = await loadPrompts(tmpDir);
    expect(p.personaPosts.productivite.system).toBe('override-prod');
    expect(p.personaPosts.popularite.system).toBe(DEFAULT_PROMPTS.personaPosts.popularite.system);
    expect(p.imageExtension).toBe(DEFAULT_PROMPTS.imageExtension);
  });
});
