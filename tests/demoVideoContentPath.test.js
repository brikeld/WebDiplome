import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  demoVideoContentDirCandidates,
  readDemoVideoAsset,
  resolveDemoVideoAssetPath,
} from '../server/lib/demoVideoContentPath.js';

let tmpDir = null;

async function makeDemoContentFile(filename = 'lake.webp') {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webdiplome-demo-video-'));
  const contentDir = path.join(tmpDir, 'contentFakePeople');
  await fs.mkdir(contentDir, { recursive: true });
  await fs.writeFile(path.join(contentDir, filename), 'demo-image');
  return { rootDir: tmpDir, contentDir, filename };
}

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

describe('demo video content path resolution', () => {
  it('prefers an explicit VIDEO_DEMO_CONTENT_DIR that points at the fake people folder', async () => {
    const { contentDir, filename } = await makeDemoContentFile('gettyimages-586890581.avif');

    const resolved = await resolveDemoVideoAssetPath(filename, {
      env: { VIDEO_DEMO_CONTENT_DIR: contentDir, VIDEO_DEMO_DIR: '/missing/root' },
    });

    expect(resolved.path).toBe(path.join(contentDir, filename));
    expect(resolved.dir).toBe(contentDir);
  });

  it('supports VIDEO_DEMO_DIR as the videoDEMO root and appends contentFakePeople', async () => {
    const { rootDir, contentDir, filename } = await makeDemoContentFile('09feb3a7ff1c1ac852dc880a6e2ef70c.jpg');

    const resolved = await resolveDemoVideoAssetPath(filename, {
      env: { VIDEO_DEMO_DIR: rootDir },
    });

    expect(resolved.path).toBe(path.join(contentDir, filename));
  });

  it('also accepts VIDEO_DEMO_DIR when it already points at contentFakePeople', async () => {
    const filename = `unique-${Date.now()}-asset.webp`;
    const { contentDir } = await makeDemoContentFile(filename);

    const resolved = await resolveDemoVideoAssetPath(filename, {
      env: { VIDEO_DEMO_DIR: contentDir },
    });

    expect(resolved.path).toBe(path.join(contentDir, filename));
  });

  it('keeps the Mac demo folder and repo fallback in the candidate list', () => {
    const candidates = demoVideoContentDirCandidates({});

    expect(candidates).toContain('/Users/brikeld/Documents/videoDEMO/contentFakePeople');
    expect(candidates.some((candidate) => candidate.endsWith(path.join('public', 'videoDEMO', 'contentFakePeople')))).toBe(true);
  });

  it('rejects path traversal and nested basenames', async () => {
    await expect(resolveDemoVideoAssetPath('../lake.webp', { env: {} })).rejects.toThrow('invalid assetBasename');
    await expect(resolveDemoVideoAssetPath('nested/lake.webp', { env: {} })).rejects.toThrow('invalid assetBasename');
    await expect(resolveDemoVideoAssetPath('nested\\lake.webp', { env: {} })).rejects.toThrow('invalid assetBasename');
  });

  it('explains how to configure the worker when the asset is missing', async () => {
    await expect(resolveDemoVideoAssetPath('missing.webp', { env: {} })).rejects.toThrow(/VIDEO_DEMO_CONTENT_DIR/);
  });

  it('fetches a public asset URL instead of requiring local files on the worker machine', async () => {
    let fetchedUrl = '';
    const asset = await readDemoVideoAsset('lake.webp', {
      assetUrl: 'https://web-diplome.vercel.app/videoDEMO/contentFakePeople/lake.webp',
      env: { VIDEO_DEMO_CONTENT_DIR: '/definitely/missing' },
      fetchImpl: async (url) => {
        fetchedUrl = String(url);
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/webp' },
        });
      },
    });

    expect(fetchedUrl).toBe('https://web-diplome.vercel.app/videoDEMO/contentFakePeople/lake.webp');
    expect(asset.source).toBe('url');
    expect(asset.mime).toBe('image/webp');
    expect([...asset.buffer]).toEqual([1, 2, 3]);
  });
});
