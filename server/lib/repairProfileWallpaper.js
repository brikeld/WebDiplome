import { normalizeImageBufferForWeb } from './normalizeImageBuffer.js';

function isTiffHead(bytes) {
  if (!bytes || bytes.length < 2) return false;
  const sig = bytes.toString('ascii', 0, 2);
  return sig === 'MM' || sig === 'II';
}

/** Re-upload TIFF/HEIC mislabeled avatars so browsers can render them in <img>. */
export async function repairProfileWallpaperIfNeeded(row, { storageStore, supabase, profileStore }) {
  if (!row?.wallpaper_url || !storageStore || !row?.user_id) return row.wallpaper_url;

  try {
    const headRes = await fetch(String(row.wallpaper_url), {
      headers: { Range: 'bytes=0-15' },
      signal: AbortSignal.timeout(8000),
    });
    if (!headRes.ok) return row.wallpaper_url;
    const head = Buffer.from(await headRes.arrayBuffer());
    if (!isTiffHead(head)) return row.wallpaper_url;

    const fullRes = await fetch(String(row.wallpaper_url), { signal: AbortSignal.timeout(20000) });
    if (!fullRes.ok) return row.wallpaper_url;
    const raw = Buffer.from(await fullRes.arrayBuffer());
    const normalized = await normalizeImageBufferForWeb(raw);
    const asset = await storageStore.uploadPublicAsset({
      ownerUserId: row.user_id,
      buffer: normalized.buffer,
      originalName: 'profile.jpg',
      mimeType: normalized.mimeType,
    });

    if (supabase && row.id) {
      await supabase
        .from('profiles')
        .update({ wallpaper_url: asset.url, updated_at: new Date().toISOString() })
        .eq('id', row.id);
    }

    return asset.url;
  } catch (err) {
    console.warn('[wallpaper-repair] skipped', row.slug, err?.message || err);
    return row.wallpaper_url;
  }
}
