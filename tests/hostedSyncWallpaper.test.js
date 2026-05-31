import { describe, expect, it } from 'vitest';

/**
 * Mirrors Electron renderer payloadForHostedSync — hosted sync must keep base64
 * when client upload did not produce a wallpaperUrl.
 */
function payloadForHostedSync(payload) {
  const out = { ...payload };
  delete out.personaPosts;
  delete out.persona_posts;
  const hasUrl = Boolean(String(out.wallpaperUrl ?? out.wallpaper_url ?? '').trim());
  if (!hasUrl) {
    delete out.wallpaperBase64;
    delete out.wallpaper_base64;
    const b64 = payload?.wallpaperBase64 ?? payload?.wallpaper_base64 ?? null;
    if (b64) out.wallpaperBase64 = b64;
  } else {
    delete out.wallpaperBase64;
    delete out.wallpaper_base64;
  }
  return out;
}

describe('payloadForHostedSync', () => {
  const b64 = 'data:image/jpeg;base64,/9j/abc';

  it('keeps base64 when upload URL is missing', () => {
    const out = payloadForHostedSync({ firstname: 'A', wallpaperBase64: b64 });
    expect(out.wallpaperBase64).toBe(b64);
    expect(out.wallpaperUrl).toBeUndefined();
  });

  it('drops base64 when upload URL is present', () => {
    const out = payloadForHostedSync({
      firstname: 'A',
      wallpaperUrl: 'https://cdn/x.jpg',
      wallpaperBase64: b64,
    });
    expect(out.wallpaperUrl).toBe('https://cdn/x.jpg');
    expect(out.wallpaperBase64).toBeUndefined();
  });
});
