import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { CHART_EXPORT_SCALE, renderSvgToPng } from '../server/lib/chartRenderer.js';

const MINI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320">
  <rect width="640" height="320" fill="#759AEF"/>
</svg>`;

describe('renderSvgToPng', () => {
  it('exports at CHART_EXPORT_SCALE for HiDPI feed display', async () => {
    const b64 = await renderSvgToPng(MINI_SVG, 640, 320);
    expect(b64).toBeTruthy();
    const meta = await sharp(Buffer.from(b64, 'base64')).metadata();
    expect(meta.width).toBe(640 * CHART_EXPORT_SCALE);
    expect(meta.height).toBe(320 * CHART_EXPORT_SCALE);
  });

  it('supports scale=1 for tests or legacy callers', async () => {
    const b64 = await renderSvgToPng(MINI_SVG, 640, 320, 1);
    const meta = await sharp(Buffer.from(b64, 'base64')).metadata();
    expect(meta.width).toBe(640);
    expect(meta.height).toBe(320);
  });
});
