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

/**
 * Pick a random asset candidate not already used in prior posts.
 * Candidates must expose a content-addressed `filename` (sha256 + ext).
 * @param {object[]} candidates
 * @param {object[]} existingPosts
 */
export function pickUnusedAssetCandidate(candidates, existingPosts) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const used = collectUsedAssetFilenames(existingPosts);
  const available = candidates.filter((c) => {
    const fn = c?.filename ? String(c.filename) : '';
    return fn && !used.has(fn);
  });

  if (available.length === 0) return null;

  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
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
