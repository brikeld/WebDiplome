import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getNewestProfileIdAndPath } from '../server/lib/currentProfile.js';

describe('currentProfile', () => {
  it('ignores account metadata when picking the newest profile', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'webdiplome-profiles-'));
    const profilePath = path.join(dir, 'alice-demo.json');
    const metaPath = path.join(dir, '_account-meta.json');
    await writeFile(profilePath, '{"firstname":"Alice"}', 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await writeFile(metaPath, '{"deletedProfileIds":[]}', 'utf8');

    const newest = await getNewestProfileIdAndPath(dir);

    expect(newest).toEqual({ id: 'alice-demo', filepath: profilePath });
  });
});
