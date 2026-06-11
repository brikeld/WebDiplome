/** macOS collector DMG — set at build time via VITE_DMG_DOWNLOAD_URL (e.g. GitHub Release asset). */

export function getDmgDownloadUrl() {
  const raw = import.meta.env.VITE_DMG_DOWNLOAD_URL;
  if (typeof raw !== 'string') return '';
  const url = raw.trim();
  if (!url || !/^https?:\/\//i.test(url)) return '';
  return url;
}

export function openDmgDownload() {
  const url = getDmgDownloadUrl();
  if (!url) return false;
  window.location.assign(url);
  return true;
}
