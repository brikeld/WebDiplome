import { describe, it, expect } from 'vitest';
import {
  BRIKELD_DEMO_ASSETS,
  loadBrikeldHarvestedWallpaper,
  remapBrikeldPostAssets,
} from '../scripts/fixtures/brikeldLocalContent.js';

describe('brikeldLocalContent', () => {
  it('loads a harvested raster wallpaper (not the BH placeholder)', () => {
    const w = loadBrikeldHarvestedWallpaper();
    expect(w.startsWith('data:image/')).toBe(true);
    expect(w).not.toContain('svg');
    expect(w.length).toBeGreaterThan(1000);
  });

  it('remaps post attachments to contentFakePeople URLs and strips chartType for halftone FX', () => {
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
      `/videoDEMO/contentFakePeople/${encodeURIComponent(BRIKELD_DEMO_ASSETS[0])}`,
    );
    expect(out[1].attachedAsset.filename).toBe(BRIKELD_DEMO_ASSETS[0]);
  });
});
