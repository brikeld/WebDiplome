import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { loadPrompts, DEFAULT_PROMPTS, DEFAULT_SLOT_PROMPTS } from '../server/lib/prompts.js';

const FULL_DEFAULTS = { ...DEFAULT_PROMPTS, slotPrompts: DEFAULT_SLOT_PROMPTS };

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
    expect(p).toEqual(FULL_DEFAULTS);
  });

  it('returns DEFAULT_PROMPTS when prompts.json is malformed JSON', async () => {
    await fs.writeFile(path.join(tmpDir, 'prompts.json'), '{ not json', 'utf8');
    const p = await loadPrompts(tmpDir);
    expect(p).toEqual(FULL_DEFAULTS);
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

describe('DEFAULT_SLOT_PROMPTS.leaderboard', () => {
  it('declares system, temperature, maxTokens', () => {
    const p = DEFAULT_SLOT_PROMPTS.leaderboard;
    expect(p).toBeTruthy();
    expect(typeof p.system).toBe('string');
    expect(p.system.length).toBeGreaterThan(50);
    expect(typeof p.temperature).toBe('number');
    expect(typeof p.maxTokens).toBe('number');
  });

  it('loadPrompts merges leaderboard slot prompt with fallback when prompts.json omits it', async () => {
    // dataDir that has no prompts.json → fall back to defaults
    const prompts = await loadPrompts('/this/path/does/not/exist');
    expect(prompts.slotPrompts.leaderboard).toBeTruthy();
    expect(typeof prompts.slotPrompts.leaderboard.system).toBe('string');
  });
});
