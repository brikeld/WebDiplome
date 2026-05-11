const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.py': 'text/x-python',
  '.js': 'application/javascript',
  '.ts': 'application/typescript',
  '.css': 'text/css',
};

export function mimeFromExt(ext) {
  const e = String(ext || '').toLowerCase();
  return EXT_TO_MIME[e] || 'application/octet-stream';
}

function extFromFilename(filename) {
  const f = String(filename || '');
  const i = f.lastIndexOf('.');
  return i >= 0 ? f.slice(i).toLowerCase() : '';
}

export function translateLegacyImage(legacy) {
  if (!legacy || typeof legacy !== 'object') return null;
  const filename = legacy.filename ?? legacy.fileName ?? legacy.file_name ?? null;
  if (!filename) return null;
  const relativePath = legacy.relativePath ?? legacy.relative_path ?? null;
  const url = legacy.url ?? legacy.imageUrl ?? legacy.image_url ?? null;
  const visionAnalysed =
    legacy.visionAnalysed ??
    legacy.vision_analysed ??
    legacy.visionAnalyzed ??
    legacy.vision_analyzed ??
    null;
  return {
    kind: 'image',
    filename,
    relativePath,
    url,
    mime: mimeFromExt(extFromFilename(filename)),
    visionAnalysed,
  };
}

export function normalizeAttachedAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const kind = asset.kind === 'document' ? 'document' : asset.kind === 'image' ? 'image' : null;
  if (!kind) return null;
  const filename = asset.filename ?? asset.fileName ?? asset.file_name ?? null;
  if (!filename) return null;
  const relativePath = asset.relativePath ?? asset.relative_path ?? null;
  const url = asset.url ?? null;
  const mime = asset.mime ?? mimeFromExt(extFromFilename(filename));
  const out = { kind, filename, relativePath, url, mime };
  if (kind === 'image') {
    out.visionAnalysed =
      asset.visionAnalysed ??
      asset.vision_analysed ??
      asset.visionAnalyzed ??
      asset.vision_analyzed ??
      null;
  }
  return out;
}
