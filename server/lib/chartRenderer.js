// SVG → PNG for the generator server (sharp). Mirrors chartRenderer.js in testCreationAcc without Electron.

import sharp from 'sharp';

/** HiDPI export multiplier — layout stays 640px logical; PNG is scaled up for crisp feed display. */
export const CHART_EXPORT_SCALE = 2;

export async function renderSvgToPng(
  svgString,
  width = 600,
  height = 300,
  scale = CHART_EXPORT_SCALE,
) {
  if (!svgString) return null;
  const exportScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const outW = Math.max(1, Math.round(width * exportScale));
  const outH = Math.max(1, Math.round(height * exportScale));
  try {
    const buf = await sharp(Buffer.from(svgString, 'utf8'))
      .resize(outW, outH)
      .png()
      .toBuffer();
    return buf.toString('base64');
  } catch {
    return null;
  }
}
