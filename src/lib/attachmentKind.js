/** @param {{ kind?: string, filename?: string, url?: string } | null | undefined} asset */
export function isPdfDocumentAsset(asset) {
  if (!asset || asset.kind !== 'document') return false;
  const name = String(asset.filename || '').toLowerCase();
  if (name.endsWith('.pdf')) return true;
  const u = String(asset.url || '').toLowerCase();
  return u.includes('.pdf');
}
