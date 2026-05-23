/**
 * Feed image FX — three steps in order:
 * 1. Gaussian blur (raw photo)
 * 2. Monochromie (persona tint)
 * 3. Trame de demi-teinte (halftone screen)
 */

export const FX_DEFAULTS = {
  blurPx: 0,
  monoStrength: 0.56,
  cellPx: 1,
  halftoneAngle: 0,
  bayerStrength: 0,
  dotScale: 0,
  thresholdBias: 0,
  paperColor: 'black',
  inkColor: 'persona',
  maxWidth: 1920,
};

export const FX_COLOR_CHOICES = ['white', 'persona', 'black'];

const CACHE = new Map();

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const h = String(hex || '').trim().replace('#', '');
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToKey({ r, g, b }) {
  return `${r},${g},${b}`;
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

function fxKey(params) {
  return Object.keys(FX_DEFAULTS)
    .map((k) => `${k}:${params[k]}`)
    .join('|');
}

function resolvePaletteColor(choice, persona) {
  const c = FX_COLOR_CHOICES.includes(choice) ? choice : 'white';
  if (c === 'black') return { r: 0, g: 0, b: 0 };
  if (c === 'persona') return persona;
  return { r: 255, g: 255, b: 255 };
}

function resolveFxColors(accentColor, fx) {
  const persona = hexToRgb(accentColor);
  return {
    paper: resolvePaletteColor(fx.paperColor, persona),
    ink: resolvePaletteColor(fx.inkColor, persona),
  };
}

/** Map luminance between paper ↔ ink. */
function applyMonochromie(data, w, h, ink, paper, strength) {
  const s = clamp(strength, 0, 1);
  for (let i = 0; i < w * h; i += 1) {
    const idx = i * 4;
    const lum =
      (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
    const k = (1 - lum) * s;
    data[idx] = Math.round(mix(paper.r, ink.r, k));
    data[idx + 1] = Math.round(mix(paper.g, ink.g, k));
    data[idx + 2] = Math.round(mix(paper.b, ink.b, k));
    data[idx + 3] = 255;
  }
}

/** Gaussian blur via canvas filter (always first in the pipeline). */
function applyGaussianBlur(sourceCanvas, blurPx) {
  const blur = typeof blurPx === 'number' ? Math.max(0, blurPx) : 0;
  if (blur <= 0) return sourceCanvas;

  const blurred = document.createElement('canvas');
  blurred.width = sourceCanvas.width;
  blurred.height = sourceCanvas.height;
  const bctx = blurred.getContext('2d', { willReadFrequently: true });
  if (!bctx) return sourceCanvas;

  bctx.filter = `blur(${blur}px)`;
  bctx.drawImage(sourceCanvas, 0, 0);
  bctx.filter = 'none';
  return blurred;
}

/** Halftone screen (ink dots on paper). */
function applyHalftoneScreen(sourceCanvas, ink, paper, fx) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no-2d-context');

  const data = ctx.getImageData(0, 0, w, h).data;

  const cell = clamp(Math.round(typeof fx.cellPx === 'number' ? fx.cellPx : 6), 1, 24);
  const angleRad = ((typeof fx.halftoneAngle === 'number' ? fx.halftoneAngle : 0) * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const bayerAmt = clamp(typeof fx.bayerStrength === 'number' ? fx.bayerStrength : 1, 0, 1);
  const strength = clamp(typeof fx.dotScale === 'number' ? fx.dotScale : 1, 0, 5);
  const tb = typeof fx.thresholdBias === 'number' ? fx.thresholdBias : 0;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) throw new Error('no-2d-context');

  const outData = octx.createImageData(w, h);
  const outPx = outData.data;

  const cx = w / 2;
  const cy = h / 2;

  for (let y = 0; y < h; y += 1) {
    const ry = y - cy;
    for (let x = 0; x < w; x += 1) {
      const rx = x - cx;
      const rotX = cosA * rx - sinA * ry;
      const rotY = sinA * rx + cosA * ry;
      const by = Math.floor(rotY / cell) % 8;
      const bx = Math.floor(rotX / cell) % 8;
      const bayerT = (BAYER8[(by + 8) % 8][(bx + 8) % 8] + 0.5) / 64;
      const threshold = mix(0.5, bayerT, bayerAmt);

      const idx = (y * w + x) * 4;
      const lum =
        (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
      const invLum = 1 - lum;
      const inkScore = invLum * (0.65 + strength * 0.7) + tb;
      const inkDot = inkScore > threshold;
      const c = inkDot ? ink : paper;

      outPx[idx] = c.r;
      outPx[idx + 1] = c.g;
      outPx[idx + 2] = c.b;
      outPx[idx + 3] = 255;
    }
  }

  octx.putImageData(outData, 0, 0);
  return out;
}

/**
 * @param {string} cachePrefix
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} drawScaled
 * @param {string} accentColor
 * @param {Record<string, unknown>} fx
 */
async function processImageFx(cachePrefix, naturalWidth, naturalHeight, drawScaled, accentColor, fx) {
  const params = { ...FX_DEFAULTS, ...fx };
  const { ink, paper } = resolveFxColors(accentColor, params);
  const key = `${cachePrefix}|${accentColor}|${rgbToKey(ink)}|${rgbToKey(paper)}|${fxKey(params)}`;
  const cached = CACHE.get(key);
  if (cached) return cached;

  const maxW = typeof params.maxWidth === 'number' && params.maxWidth > 0 ? params.maxWidth : 860;
  const scale = Math.min(1, maxW / naturalWidth);
  const w = Math.max(1, Math.round(naturalWidth * scale));
  const h = Math.max(1, Math.round(naturalHeight * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (!wctx) throw new Error('no-2d-context');

  drawScaled(wctx, w, h);

  const afterBlur = applyGaussianBlur(work, params.blurPx);
  const fxCtx = afterBlur.getContext('2d', { willReadFrequently: true });
  if (!fxCtx) throw new Error('no-2d-context');

  const imgData = fxCtx.getImageData(0, 0, w, h);
  applyMonochromie(imgData.data, w, h, ink, paper, params.monoStrength);
  fxCtx.putImageData(imgData, 0, 0);

  const halftoned = applyHalftoneScreen(afterBlur, ink, paper, params);

  const outUrl = halftoned.toDataURL('image/png');
  CACHE.set(key, outUrl);
  return outUrl;
}

/** Flat tint like algorithm charts: persona paper, black ink (no blur / halftone). */
export function tintChartStyleFromCanvas(canvas, accentColor) {
  const persona = hexToRgb(accentColor);
  const ink = { r: 0, g: 0, b: 0 };
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no-2d-context');

  const imgData = ctx.getImageData(0, 0, w, h);
  applyMonochromie(imgData.data, w, h, ink, persona, 1);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function ditherMonochromeFromUrl({ src, accentColor, ...fx }) {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = src;
  });

  return processImageFx(
    src,
    img.naturalWidth,
    img.naturalHeight,
    (wctx, cw, ch) => {
      wctx.drawImage(img, 0, 0, cw, ch);
    },
    accentColor,
    fx,
  );
}

