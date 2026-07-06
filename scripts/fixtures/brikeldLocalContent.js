/**
 * Local-demo overrides for Brikeld Hoxha: harvested avatar + contentFakePeople
 * post attachments (same pool as the seeded fake-user posts).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetFor } from './demoFakeContent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Filenames in public/videoDEMO/contentFakePeople — one per post that has an attachment. */
export const BRIKELD_DEMO_ASSETS = [
  'lake.webp',
  'Screenshot 2026-06-29 at 11.24.24.png',
  'cat.jpg',
  '09feb3a7ff1c1ac852dc880a6e2ef70c.jpg',
  'a49d7df20838811b3eee69a977e57c05.webp',
  'street-with-eiffel-tower-in-the-middle-on-a-sunny-royalty-free-image-1717187207.avif',
  '47f85bb0022f16eadee6761b7c7d9b06.webp',
  'invoice-number.jpeg',
  '637627ca9eebde45ae5f394c_Underwater-Nun.jpeg',
  'gettyimages-586890581.avif',
  'cv-template.pdf',
  '2024D117_ITALIANSEO_POMODORO_2_X-1-768x960.jpg',
];

let cachedWallpaper = null;

/** Harvested macOS wallpaper portrait captured from a real profile sync. */
export function loadBrikeldHarvestedWallpaper() {
  if (cachedWallpaper) return cachedWallpaper;
  const raw = readFileSync(join(__dirname, 'brikeld-wallpaper.json'), 'utf8');
  const { wallpaperBase64 } = JSON.parse(raw);
  if (!wallpaperBase64 || String(wallpaperBase64).includes('svg')) {
    throw new Error('brikeld-wallpaper.json must contain a harvested raster wallpaperBase64');
  }
  cachedWallpaper = wallpaperBase64;
  return cachedWallpaper;
}

/** Swap /uploads attachments for contentFakePeople assets (order matches fixture posts). */
export function remapBrikeldPostAssets(posts) {
  let assetIdx = 0;
  return (Array.isArray(posts) ? posts : []).map((post) => {
    if (!post?.attachedAsset) return post;
    const filename = BRIKELD_DEMO_ASSETS[assetIdx];
    assetIdx += 1;
    if (!filename) return post;
    // Demo photo attachments are not algorithm charts — strip chartType so halftone
    // FX applies like the other seeded fake-user posts.
    const { chartType, chart_type, chartContext, chart_context, ...rest } = post;
    return { ...rest, attachedAsset: assetFor(filename) };
  });
}
