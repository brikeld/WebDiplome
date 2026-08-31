/**
 * Local-demo overrides for Brikeld Hoxha: harvested avatar wallpaper +
 * post attachments from the dedicated contentDemoBrikeld folder (not
 * contentFakePeople, which is reserved for the other seeded users).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Authoritative source on disk (sibling to the repo, not inside WebDiplome). */
export const BRIKELD_CONTENT_SOURCE_DIR =
  process.env.BRIKELD_DEMO_CONTENT_DIR?.trim()
  || '/Users/brikeld/Documents/contentDemoBrikeld';

/** Vite/static URL path after `npm run seed:local` copies assets into public/. */
export const BRIKELD_CONTENT_WEB_PATH = '/videoDEMO/contentDemoBrikeld';

const MIME_BY_EXT = {
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function extname(filename) {
  const match = String(filename || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? '';
}

/**
 * Post attachment pool (excludes profile.png). Cycled when there are more
 * attached posts than unique files.
 */
export const BRIKELD_POST_ASSET_POOL = [
  'ecal.jpg',
  'hahaha.jpg',
  'jeff.jpg',
  'Screenshot 2026-06-14 at 22.29.30.png',
  '00_Planning Diplômes  25-26.pdf',
  'HG Studio - Offre Carres Surprises.pdf',
  '004-02+_Systeme-de-calcul-des-honoraires-SGD.pdf',
];

/** @deprecated Use BRIKELD_POST_ASSET_POOL — kept for tests that import the old name. */
export const BRIKELD_DEMO_ASSETS = BRIKELD_POST_ASSET_POOL;

export function brikeldAssetFor(filename) {
  const ext = extname(filename);
  const kind = ext === '.pdf' ? 'document' : 'image';
  return {
    kind,
    filename,
    mime: MIME_BY_EXT[ext] ?? 'application/octet-stream',
    url: `${BRIKELD_CONTENT_WEB_PATH}/${encodeURIComponent(filename)}`,
    relativePath: `public${BRIKELD_CONTENT_WEB_PATH}/${filename}`,
    ...(kind === 'image' ? { visionAnalysed: true } : {}),
  };
}

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

/**
 * Copy Brikeld demo assets from contentDemoBrikeld into public/ so Vite can
 * serve them at BRIKELD_CONTENT_WEB_PATH.
 */
export function syncBrikeldContentAssets(
  publicDir,
  sourceDir = BRIKELD_CONTENT_SOURCE_DIR,
) {
  if (!existsSync(sourceDir)) {
    throw new Error(
      `Brikeld demo content folder not found: ${sourceDir}\n`
      + 'Set BRIKELD_DEMO_CONTENT_DIR or place assets at the default path.',
    );
  }
  mkdirSync(publicDir, { recursive: true });
  for (const filename of BRIKELD_POST_ASSET_POOL) {
    const src = join(sourceDir, filename);
    if (!existsSync(src)) {
      throw new Error(`Missing Brikeld demo asset "${filename}" in ${sourceDir}`);
    }
    copyFileSync(src, join(publicDir, filename));
  }
}

/** Swap /uploads attachments for contentDemoBrikeld assets (cycled pool). */
export function remapBrikeldPostAssets(posts) {
  let assetIdx = 0;
  return (Array.isArray(posts) ? posts : []).map((post) => {
    if (!post?.attachedAsset) return post;
    const filename = BRIKELD_POST_ASSET_POOL[assetIdx % BRIKELD_POST_ASSET_POOL.length];
    assetIdx += 1;
    // Demo photo attachments are not algorithm charts — strip chartType so halftone
    // FX applies like the other seeded fake-user posts.
    const { chartType, chart_type, chartContext, chart_context, ...rest } = post;
    return { ...rest, attachedAsset: brikeldAssetFor(filename) };
  });
}
