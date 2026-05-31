import sharp from 'sharp';

const WEB_SAFE = new Set(['jpeg', 'png', 'webp', 'gif']);

function sniffFormat(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png';
  if (buffer.toString('ascii', 0, 3) === 'GIF') return 'gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.toString('ascii', 0, 2) === 'MM' || buffer.toString('ascii', 0, 2) === 'II') return 'tiff';
  return null;
}

/** Convert any raster profile pic to browser-safe JPEG (fixes TIFF-as-.jpg from macOS harvest). */
export async function normalizeImageBufferForWeb(buffer, { maxSide = 1024 } = {}) {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!input.length) throw new Error('empty image buffer');

  const sniffed = sniffFormat(input);
  if (sniffed === 'jpeg' && input.length <= 900_000) {
    return { buffer: input, mimeType: 'image/jpeg', ext: '.jpg' };
  }

  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata().catch(() => ({}));
  const format = meta.format || sniffed;

  if (WEB_SAFE.has(format) && format === 'jpeg' && input.length <= 900_000) {
    return { buffer: input, mimeType: 'image/jpeg', ext: '.jpg' };
  }

  const out = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({
      width: maxSide,
      height: maxSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return { buffer: out, mimeType: 'image/jpeg', ext: '.jpg' };
}

export function needsWebImageNormalization(buffer) {
  const format = sniffFormat(buffer);
  return format != null && format !== 'jpeg' && format !== 'png' && format !== 'webp' && format !== 'gif';
}
