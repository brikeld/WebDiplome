// SVG → PNG for the generator server (sharp). Mirrors chartRenderer.js in testCreationAcc without Electron.

import sharp from 'sharp';

export async function renderSvgToPng(svgString, width = 600, height = 300) {
  if (!svgString) return null;
  try {
    const buf = await sharp(Buffer.from(svgString, 'utf8'))
      .resize(width, height)
      .png()
      .toBuffer();
    return buf.toString('base64');
  } catch {
    return null;
  }
}
