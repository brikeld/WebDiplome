import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRIKELD_CONTENT_SOURCE_DIR,
  BRIKELD_CONTENT_WEB_PATH,
  BRIKELD_POST_ASSET_POOL,
  loadBrikeldHarvestedWallpaper,
  remapBrikeldPostAssets,
} from '../scripts/fixtures/brikeldLocalContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('brikeldLocalContent', () => {
  it('loads a harvested raster wallpaper (not the BH placeholder)', () => {
    const w = loadBrikeldHarvestedWallpaper();
    expect(w.startsWith('data:image/')).toBe(true);
    expect(w).not.toContain('svg');
    expect(w.length).toBeGreaterThan(1000);
  });

  it('remaps post attachments to contentDemoBrikeld URLs and strips chartType for halftone FX', () => {
    const posts = [
      { content: 'no asset' },
      {
        content: 'with asset',
        chartType: 'browser_domains',
        attachedAsset: {
          kind: 'image',
          url: '/uploads/old.png',
          filename: 'old.png',
        },
      },
    ];
    const out = remapBrikeldPostAssets(posts);
    expect(out[0]).toBe(posts[0]);
    expect(out[1].chartType).toBeUndefined();
    expect(out[1].attachedAsset.url).toBe(
      `${BRIKELD_CONTENT_WEB_PATH}/${encodeURIComponent(BRIKELD_POST_ASSET_POOL[0])}`,
    );
    expect(out[1].attachedAsset.filename).toBe(BRIKELD_POST_ASSET_POOL[0]);
    expect(out[1].attachedAsset.url).toContain('/videoDEMO/contentDemoBrikeld/');
    expect(out[1].attachedAsset.url).not.toContain('contentFakePeople');
  });

  it('cycles the asset pool when there are more attachments than files', () => {
    const posts = Array.from({ length: BRIKELD_POST_ASSET_POOL.length + 2 }, () => ({
      attachedAsset: { kind: 'image', url: '/uploads/x.png', filename: 'x.png' },
    }));
    const out = remapBrikeldPostAssets(posts);
    expect(out[0].attachedAsset.filename).toBe(BRIKELD_POST_ASSET_POOL[0]);
    expect(out[BRIKELD_POST_ASSET_POOL.length].attachedAsset.filename).toBe(
      BRIKELD_POST_ASSET_POOL[0],
    );
  });

  it('source pool files exist on the author machine content folder', () => {
    if (!existsSync(BRIKELD_CONTENT_SOURCE_DIR)) return;
    for (const filename of BRIKELD_POST_ASSET_POOL) {
      expect(existsSync(join(BRIKELD_CONTENT_SOURCE_DIR, filename))).toBe(true);
    }
  });
});
