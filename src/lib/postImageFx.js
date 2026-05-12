// Locked-in tuned values (from your chosen debug settings)
export const FX_DEFAULTS = {
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

function fxKey({
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
  return `b:${blurPx}|c:${cellPx}|d:${dotScale}|br:${brightness}|ct:${contrast}|ga:${gamma}|tb:${thresholdBias}|na:${noiseAmount}|ns:${noiseSeed}|iv:${invert}|w:${maxWidth}`;
}

/**
 * @param {string} cachePrefix — unique id for cache (url or pdf page key)
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} drawScaled
 * @param {string} accentColor
 * @param {Record<string, unknown>} fx
 */
async function ditherMonochromeCore(cachePrefix, naturalWidth, naturalHeight, drawScaled, accentColor, fx) {
  const {
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
  } = { ...FX_DEFAULTS, ...fx };

  const key = `${cachePrefix}|${accentColor}|${fxKey({
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
  })}`;

  const cached = CACHE.get(key);
  if (cached) return cached;

  const maxW = typeof maxWidth === 'number' && maxWidth > 0 ? maxWidth : 860;
  const scale = Math.min(1, maxW / naturalWidth);
  const w = Math.max(1, Math.round(naturalWidth * scale));
  const h = Math.max(1, Math.round(naturalHeight * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (!wctx) throw new Error('no-2d-context');

  const blur = typeof blurPx === 'number' ? blurPx : 9.5;
  wctx.filter = `blur(${blur}px) grayscale(1)`;
  drawScaled(wctx, w, h);
  wctx.filter = 'none';

  const imgData = wctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const cell = typeof cellPx === 'number' ? clamp(Math.round(cellPx), 0, 24) : 6;
  const safeCell = cell <= 0 ? 1 : cell;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) throw new Error('no-2d-context');

  const { r, g, b } = hexToRgb(accentColor);

  const outData = octx.createImageData(w, h);
  const outPx = outData.data;

  const strength = typeof dotScale === 'number' ? clamp(dotScale, 0, 1) : 0.55;
  const br = typeof brightness === 'number' ? brightness : 0;
  const ct = typeof contrast === 'number' ? contrast : 1;
  const ga = typeof gamma === 'number' ? gamma : 1;
  const tb = typeof thresholdBias === 'number' ? thresholdBias : 0;
  const na = typeof noiseAmount === 'number' ? clamp(noiseAmount, 0, 1) : 0;
  const ns = typeof noiseSeed === 'number' ? noiseSeed : 1;
  const iv = typeof invert === 'number' ? invert : 0;

  const rand01 = (x, y) => {
    let t = (x * 374761393 + y * 668265263 + ns * 1442695041) >>> 0;
    t = (t ^ (t >> 13)) >>> 0;
    t = (t * 1274126177) >>> 0;
    return ((t ^ (t >> 16)) >>> 0) / 4294967295;
  };

  for (let y = 0; y < h; y += 1) {
    const by = Math.floor(y / safeCell) % 8;
    for (let x = 0; x < w; x += 1) {
      const bx = Math.floor(x / safeCell) % 8;
      const threshold = (BAYER8[by][bx] + 0.5) / 64;
      const idx = (y * w + x) * 4;
      let lum = data[idx] / 255;

      lum = clamp((lum - 0.5) * ct + 0.5 + br, 0, 1);
      if (ga !== 1) lum = clamp(Math.pow(lum, 1 / ga), 0, 1);

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

  if (iv >= 1) {
    for (let i = 0; i < outPx.length; i += 4) {
      const isPersona = outPx[i] === r && outPx[i + 1] === g && outPx[i + 2] === b;
      if (isPersona) {
        outPx[i] = 0;
        outPx[i + 1] = 0;
        outPx[i + 2] = 0;
      } else {
        outPx[i] = r;
        outPx[i + 1] = g;
        outPx[i + 2] = b;
      }
    }
  }

  octx.putImageData(outData, 0, 0);

  const outUrl = out.toDataURL('image/png');
  CACHE.set(key, outUrl);
  return outUrl;
}

/** Same pipeline as post images: halftone + persona tint. */
export async function ditherMonochromeFromUrl({ src, accentColor, ...fx }) {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = src;
  });

  const cachePrefix = src;
  return ditherMonochromeCore(
    cachePrefix,
    img.naturalWidth,
    img.naturalHeight,
    (wctx, w, h) => {
      wctx.drawImage(img, 0, 0, w, h);
    },
    accentColor,
    fx,
  );
}

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas — RGB page bitmap (e.g. from pdf.js)
 * @param {string} opts.cacheKey — stable key for CACHE (e.g. pdf URL + page index)
 * @param {string} opts.accentColor
 */
export async function ditherMonochromeFromCanvas({ canvas, cacheKey, accentColor, ...fx }) {
  return ditherMonochromeCore(
    cacheKey,
    canvas.width,
    canvas.height,
    (wctx, w, h) => {
      wctx.drawImage(canvas, 0, 0, w, h);
    },
    accentColor,
    fx,
  );
}
