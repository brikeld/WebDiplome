import { useEffect, useState } from 'react';
import '../../styles/postImage.css';

// Locked-in tuned values (from your chosen debug settings)
const FX_DEFAULTS = {
  blurPx: 0,
  cellPx: 0,
  dotScale: 0,
  brightness: 0.18,
  contrast: 2.2,
  gamma: 2.6,
  thresholdBias: 0.02,
  noiseAmount: 0,
  noiseSeed: 296,
  invert: 0,
  maxWidth: 1140,
};

const CACHE = new Map();

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function hexToRgb(hex) {
  const h = String(hex || '').trim().replace('#', '');
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function makeBayer8() {
  // 8x8 Bayer matrix (0..63), normalized later to 0..1
  return [
    [0, 48, 12, 60, 3, 51, 15, 63],
    [32, 16, 44, 28, 35, 19, 47, 31],
    [8, 56, 4, 52, 11, 59, 7, 55],
    [40, 24, 36, 20, 43, 27, 39, 23],
    [2, 50, 14, 62, 1, 49, 13, 61],
    [34, 18, 46, 30, 33, 17, 45, 29],
    [10, 58, 6, 54, 9, 57, 5, 53],
    [42, 26, 38, 22, 41, 25, 37, 21],
  ];
}

const BAYER8 = makeBayer8();

async function ditherMonochrome({
  src,
  accentColor,
  blurPx,
  cellPx,
  dotScale,
  brightness,
  contrast,
  gamma,
  thresholdBias,
  noiseAmount,
  noiseSeed,
  invert,
  maxWidth,
}) {
  const key = `${src}|${accentColor}|b:${blurPx}|c:${cellPx}|d:${dotScale}|br:${brightness}|ct:${contrast}|ga:${gamma}|tb:${thresholdBias}|na:${noiseAmount}|ns:${noiseSeed}|iv:${invert}|w:${maxWidth}`;
  const cached = CACHE.get(key);
  if (cached) return cached;

  const img = new Image();
  img.crossOrigin = 'anonymous';

  const url = await new Promise((resolve, reject) => {
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = src;
  });

  // Scale down work for speed; output is still crisp enough for the feed.
  const maxW = typeof maxWidth === 'number' && maxWidth > 0 ? maxWidth : 860;
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (!wctx) throw new Error('no-2d-context');

  // Step 1–2: Gaussian blur radius + grayscale
  // (Canvas filter blur is gaussian-ish and matches the request closely.)
  const blur = typeof blurPx === 'number' ? blurPx : 9.5;
  wctx.filter = `blur(${blur}px) grayscale(1)`;
  wctx.drawImage(img, 0, 0, w, h);
  wctx.filter = 'none';

  // Pull grayscale brightness from the blurred image.
  const imgData = wctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Step 3: ordered dithering. cellPx controls the "pixel" size (bigger = chunkier).
  const cell = typeof cellPx === 'number' ? clamp(Math.round(cellPx), 0, 24) : 6;
  const safeCell = cell <= 0 ? 1 : cell;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) throw new Error('no-2d-context');

  // Step 4–5: grayscale → monochrome (tinted with persona color)
  const { r, g, b } = hexToRgb(accentColor);

  const outData = octx.createImageData(w, h);
  const outPx = outData.data;

  // dotScale now behaves like "dither strength": 0..1 (higher = more ink).
  const strength = typeof dotScale === 'number' ? clamp(dotScale, 0, 1) : 0.55;
  const br = typeof brightness === 'number' ? brightness : 0;
  const ct = typeof contrast === 'number' ? contrast : 1;
  const ga = typeof gamma === 'number' ? gamma : 1;
  const tb = typeof thresholdBias === 'number' ? thresholdBias : 0;
  const na = typeof noiseAmount === 'number' ? clamp(noiseAmount, 0, 1) : 0;
  const ns = typeof noiseSeed === 'number' ? noiseSeed : 1;
  const iv = typeof invert === 'number' ? invert : 0;

  const rand01 = (x, y) => {
    // deterministic hash → 0..1
    let t = (x * 374761393 + y * 668265263 + ns * 1442695041) >>> 0;
    t = (t ^ (t >> 13)) >>> 0;
    t = (t * 1274126177) >>> 0;
    return ((t ^ (t >> 16)) >>> 0) / 4294967295;
  };

  // For every output pixel: decide ink/no-ink using Bayer threshold, grouped by cell.
  for (let y = 0; y < h; y += 1) {
    const by = (Math.floor(y / safeCell) % 8);
    for (let x = 0; x < w; x += 1) {
      const bx = (Math.floor(x / safeCell) % 8);
      const threshold = (BAYER8[by][bx] + 0.5) / 64; // 0..1
      const idx = (y * w + x) * 4;
      let lum = data[idx] / 255; // grayscale (r channel)

      // Tone controls in luminance space
      lum = clamp((lum - 0.5) * ct + 0.5 + br, 0, 1);
      if (ga !== 1) lum = clamp(Math.pow(lum, 1 / ga), 0, 1);

      // Noise (helps break up banding)
      if (na > 0) lum = clamp(lum + (rand01(x, y) - 0.5) * na, 0, 1);

      const invLum = 1 - lum;
      const inkScore = invLum * (0.65 + strength * 0.7) + tb;
      const ink = inkScore > threshold;
      if (ink) {
        outPx[idx] = r;
        outPx[idx + 1] = g;
        outPx[idx + 2] = b;
        outPx[idx + 3] = 255;
      } else {
        outPx[idx] = 0;
        outPx[idx + 1] = 0;
        outPx[idx + 2] = 0;
        outPx[idx + 3] = 255;
      }
    }
  }

  // Invert: swap persona/black
  if (iv >= 1) {
    for (let i = 0; i < outPx.length; i += 4) {
      const isPersona = outPx[i] === r && outPx[i + 1] === g && outPx[i + 2] === b;
      if (isPersona) {
        outPx[i] = 0; outPx[i + 1] = 0; outPx[i + 2] = 0;
      } else {
        outPx[i] = r; outPx[i + 1] = g; outPx[i + 2] = b;
      }
    }
  }

  octx.putImageData(outData, 0, 0);

  const outUrl = out.toDataURL('image/png');
  CACHE.set(key, outUrl);
  return outUrl;
}

export default function PostImage({ asset, src: rawSrc, alt: rawAlt, accentColor }) {
  const src = asset?.url ?? rawSrc ?? '';
  const alt = rawAlt ?? asset?.filename ?? '';
  const [processedSrc, setProcessedSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProcessedSrc(null);
    ditherMonochrome({
      src,
      accentColor,
      ...FX_DEFAULTS,
    })
      .then((u) => {
        if (!cancelled) setProcessedSrc(u);
      })
      .catch(() => {
        // If CORS blocks canvas or anything fails, fall back to the raw image.
        if (!cancelled) setProcessedSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src, accentColor]);

  return (
    <div
      className="post-attachment-block post-image-halftone"
    >
      <img
        className="post-attachment-img"
        src={processedSrc || src}
        alt={alt || ''}
        loading="lazy"
      />
    </div>
  );
}
