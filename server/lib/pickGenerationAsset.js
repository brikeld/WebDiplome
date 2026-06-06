import { filterVisualGenerationAssets } from './generationAssetTypes.js';
import { parseHarvestTimestamp } from './recencyRanking.js';

/** @param {object[]} existingPosts */
export function collectUsedAssetFilenames(existingPosts) {
  const used = new Set();
  for (const post of existingPosts ?? []) {
    if (!post || typeof post !== 'object') continue;
    const asset = post.attachedAsset ?? post.attached_asset ?? post.attachedImage ?? post.attached_image;
    if (!asset || typeof asset !== 'object') continue;
    if (asset.filename) used.add(String(asset.filename));
    const url = asset.url ? String(asset.url) : '';
    const base = url.split('/').pop()?.split('?')[0];
    if (base) used.add(base);
  }
  return used;
}

/** @param {object|null|undefined} candidate */
export function candidateContentFilename(candidate) {
  if (!candidate || typeof candidate !== 'object') return '';
  return String(candidate.filename ?? candidate.uploadFilename ?? '').trim();
}

/** Merge hosted asset pools keyed by content-addressed filename. */
export function mergeAssetCandidatePool(existing = [], incoming = []) {
  const byFilename = new Map();
  for (const candidate of [...existing, ...incoming]) {
    const filename = candidateContentFilename(candidate);
    const url = candidate?.url ? String(candidate.url).trim() : '';
    if (!filename || !url) continue;
    byFilename.set(filename, { ...candidate, filename });
  }
  return [...byFilename.values()];
}

/**
 * Pick a random asset candidate not already used in prior posts.
 * Candidates must expose a content-addressed `filename` (sha256 + ext).
 * @param {object[]} candidates
 * @param {object[]} existingPosts
 */
export function pickUnusedAssetCandidate(candidates, existingPosts) {
  const visualCandidates = filterVisualGenerationAssets(candidates);
  if (visualCandidates.length === 0) return null;

  const used = collectUsedAssetFilenames(existingPosts);
  const available = visualCandidates.filter((c) => {
    const fn = candidateContentFilename(c);
    return fn && !used.has(fn);
  });

  if (available.length === 0) return null;

  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}

/**
 * Pick the freshest unused visual asset (images/PDFs). Skips assets already posted;
 * next generation naturally takes the second-newest, and so on.
 */
export function pickRecencyFirstUnusedAssetCandidate(candidates, existingPosts) {
  const visualCandidates = filterVisualGenerationAssets(candidates);
  if (visualCandidates.length === 0) return null;

  const used = collectUsedAssetFilenames(existingPosts);
  const available = visualCandidates.filter((c) => {
    const fn = candidateContentFilename(c);
    return fn && !used.has(fn);
  });
  if (available.length === 0) return null;

  const ranked = available
    .map((c) => ({
      candidate: c,
      mtimeMs: Number(c.mtimeMs ?? c.modifiedMs ?? parseHarvestTimestamp(c.modified) ?? 0),
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const topMs = ranked[0]?.mtimeMs ?? 0;
  const topTier = ranked.filter((r) => r.mtimeMs === topMs);
  const pick = topTier[Math.floor(Math.random() * topTier.length)];
  return pick?.candidate ?? ranked[0].candidate;
}

export const ASSET_PERSONA_CYCLE = ['popularite', 'securite', 'productivite'];

export function mostRecentPersonaWithAsset(existingPosts) {
  if (!Array.isArray(existingPosts)) return null;
  for (const post of existingPosts) {
    if (!post?.attachedAsset && !post?.attached_asset && !post?.attachedImage) continue;
    const persona = String(post.persona || '').toLowerCase();
    if (ASSET_PERSONA_CYCLE.includes(persona)) return persona;
  }
  return null;
}

export function nextAssetPersona(existingPosts) {
  const prev = mostRecentPersonaWithAsset(existingPosts);
  if (!prev) return ASSET_PERSONA_CYCLE[0];
  const idx = ASSET_PERSONA_CYCLE.indexOf(prev);
  return ASSET_PERSONA_CYCLE[(idx + 1) % ASSET_PERSONA_CYCLE.length];
}
