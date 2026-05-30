import sharp from 'sharp';

const MAX_DOC_CHARS = 2048;
const MAX_IMAGE_DIM = 512;

export function capDocumentText(text) {
  return String(text ?? '').slice(0, MAX_DOC_CHARS);
}

/** Downscale images so vision prompts fit modest context windows (e.g. n_ctx=4096). */
export async function prepareImageForLmVision(buffer) {
  if (!buffer?.length) return null;
  try {
    let img = sharp(buffer);
    const meta = await img.metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w > MAX_IMAGE_DIM || h > MAX_IMAGE_DIM) {
      img = img.resize(MAX_IMAGE_DIM, MAX_IMAGE_DIM, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    const out = await img.jpeg({ quality: 72 }).toBuffer();
    if (!out.length) return null;
    return { base64: out.toString('base64'), mime: 'image/jpeg' };
  } catch {
    return null;
  }
}
