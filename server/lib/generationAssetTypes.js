import path from 'path';

/** Extensions eligible for the visual asset post slot (UI + vision/PDF preview). */
export const GENERATION_IMAGE_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
]);

export const GENERATION_DOCUMENT_EXTS = new Set(['.pdf']);

export const GENERATION_VISUAL_EXTS = new Set([
  ...GENERATION_IMAGE_EXTS,
  ...GENERATION_DOCUMENT_EXTS,
]);

export function extensionFromAssetCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return '';
  for (const field of ['filename', 'uploadFilename', 'sourceFilename']) {
    const raw = candidate[field];
    if (!raw) continue;
    const ext = path.extname(String(raw)).toLowerCase();
    if (ext) return ext;
  }
  return '';
}

export function isVisualGenerationAsset(candidate) {
  const ext = extensionFromAssetCandidate(candidate);
  return ext ? GENERATION_VISUAL_EXTS.has(ext) : false;
}

export function filterVisualGenerationAssets(candidates) {
  if (!Array.isArray(candidates)) return [];
  return candidates.filter(isVisualGenerationAsset);
}
