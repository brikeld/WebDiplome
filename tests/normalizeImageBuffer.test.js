import { describe, expect, it } from 'vitest';
import { normalizeImageBufferForWeb, needsWebImageNormalization } from '../server/lib/normalizeImageBuffer.js';

describe('normalizeImageBufferForWeb', () => {
  it('detects TIFF as needing normalization', () => {
    const head = Buffer.from([0x4d, 0x4d, 0x00, 0x2a]);
    expect(needsWebImageNormalization(head)).toBe(true);
  });

  it('converts Emanuel TIFF avatar to JPEG', async () => {
    const res = await fetch(
      'https://qjaoxjwtkikyefnumcvw.supabase.co/storage/v1/object/public/uploads-public/d943559536f85d3aca10bb2af36ca4a8e599aa337dac11398c05cf14857a9a65.jpg',
    );
    expect(res.ok).toBe(true);
    const raw = Buffer.from(await res.arrayBuffer());
    expect(needsWebImageNormalization(raw)).toBe(true);
    const out = await normalizeImageBufferForWeb(raw);
    expect(out.mimeType).toBe('image/jpeg');
    expect(out.buffer[0]).toBe(0xff);
    expect(out.buffer[1]).toBe(0xd8);
    expect(out.buffer.length).toBeLessThan(raw.length);
  });
});
