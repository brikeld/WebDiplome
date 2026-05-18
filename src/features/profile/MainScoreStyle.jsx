import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getCenterDisplayScore, getMainScoreRingValues } from '@/lib/profileUtils.js';

const PERSONA_COLORS = {
  prod: '#D8D8D8',
  social: '#CCF847',
  sec: '#759AEF',
};

const METRICS_ORDER = ['prod', 'social', 'sec'];

const T_EPS = 0.002;
const T_LERP = 0.052;

function drawArcChart(canvas, width, height, values, fonts, centerScore, t, showCenterScore) {
  const W = width;
  const H = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const tt = Math.max(0, Math.min(1, t));

  const logical = Math.min(W, H);
  const CX = W / 2;
  const CY = H / 2;
  const scale = logical / 200;

  const keys = METRICS_ORDER;
  const startAngle = -Math.PI * 0.8;
  const sweepTotal = Math.PI * 1.6;

  const radii = [0.408 * logical, 0.292 * logical, 0.195 * logical];
  const thickness = Math.max(5, 12 * scale);

  ctx.clearRect(0, 0, W, H);

  keys.forEach((key, i) => {
    const r = radii[i] ?? radii[radii.length - 1] - i * 16 * scale;
    const valueFraction = values[key] / 100;
    const color = PERSONA_COLORS[key];

    ctx.beginPath();
    ctx.arc(CX, CY, r, startAngle, startAngle + sweepTotal);
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.stroke();

    const endAngle = startAngle + sweepTotal * valueFraction * tt;
    ctx.beginPath();
    ctx.arc(CX, CY, r, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 7 * scale;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const ex = CX + r * Math.cos(endAngle);
    const ey = CY + r * Math.sin(endAngle);
    const grd = ctx.createRadialGradient(ex, ey, 0, ex, ey, 9 * scale);
    grd.addColorStop(0, `${color}aa`);
    grd.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(ex, ey, 9 * scale, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  });

  if (!showCenterScore) return;

  const label = Math.round(centerScore * tt);

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = fonts.main;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label), CX, CY);
}

/**
 * @param {object} [opts]
 * @param {object} opts.profile
 * @param {number} [opts.entryReplayKey] — ring animation replays only when this changes (profile visits). Omit on landing: use score-driven replay instead.
 * @param {boolean} [opts.hideCenterScore]
 */
export default function MainScoreStyle({ profile, entryReplayKey, hideCenterScore = false }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  const layoutRef = useRef({
    cssW: 1,
    cssH: 1,
    fonts: { main: '' },
    values: { prod: 0, social: 0, sec: 0 },
    centerScore: 0,
  });

  const tRef = useRef(0);
  const rafRef = useRef(null);
  const prevScoreKeyRef = useRef(/** @type {string | null} */ (null));

  const scoreKey = useMemo(
    () =>
      `${profile?.globalScore ?? ''}:${profile?.score ?? ''}:${JSON.stringify(profile?.personaScores ?? profile?.persona_scores ?? null)}`,
    [profile?.globalScore, profile?.score, profile?.personaScores, profile?.persona_scores],
  );

  const cancelLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const syncLayout = useCallback(() => {
    const el = wrapRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const rect = el.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    const logical = Math.min(cssW, cssH);

    const prev = layoutRef.current;
    const sizeChanged = cssW !== prev.cssW || cssH !== prev.cssH;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    if (sizeChanged) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const root = document.documentElement;
    const sans =
      getComputedStyle(root).getPropertyValue('--font-sans').trim() ||
      "'AvantGarde ITC BT', system-ui, sans-serif";

    const scaleRef = logical / 200;
    const thicknessEst = Math.max(5, 12 * scaleRef);
    const innerArcR = 0.195 * logical;
    const innerHoleR = Math.max(4, innerArcR - thicknessEst / 2);
    const desiredPx = Math.round(logical * 0.36);
    const maxPxByHole = Math.floor(innerHoleR * 1.05);
    const mainPx = Math.max(18, Math.min(desiredPx, maxPxByHole));

    const fonts = {
      main: `700 ${mainPx}px ${sans}`,
    };

    const values = getMainScoreRingValues(profile ?? {});
    const centerScore = getCenterDisplayScore(profile ?? {});

    layoutRef.current = { cssW, cssH, fonts, values, centerScore };
  }, [profile]);

  const drawFrame = useCallback(
    (t) => {
      const canvas = canvasRef.current;
      const { cssW, cssH, fonts, values, centerScore } = layoutRef.current;
      if (!canvas) return;
      drawArcChart(canvas, cssW, cssH, values, fonts, centerScore, t, !hideCenterScore);
    },
    [hideCenterScore],
  );

  const stepAnimation = useCallback(() => {
    let t = tRef.current;
    t += (1 - t) * T_LERP;
    if (Math.abs(1 - t) < T_EPS) {
      t = 1;
    }
    tRef.current = t;
    drawFrame(t);
    if (t < 1) {
      rafRef.current = requestAnimationFrame(stepAnimation);
    } else {
      rafRef.current = null;
    }
  }, [drawFrame]);

  const replay = useCallback(() => {
    cancelLoop();
    tRef.current = 0;
    syncLayout();
    drawFrame(0);
    rafRef.current = requestAnimationFrame(stepAnimation);
  }, [cancelLoop, drawFrame, stepAnimation, syncLayout]);

  /** Profile: replay rings only when navigating onto the profile (key bumps). */
  useEffect(() => {
    if (entryReplayKey === undefined) return undefined;
    prevScoreKeyRef.current = null;
    replay();
    return () => cancelLoop();
  }, [entryReplayKey, replay, cancelLoop]);

  /** Landing / demo: replay when the demo score payload changes. */
  useEffect(() => {
    if (entryReplayKey !== undefined) return undefined;
    replay();
    return () => cancelLoop();
  }, [scoreKey, entryReplayKey, replay, cancelLoop]);

  /** Profile: poll updated scores — redraw full arcs, no replay. */
  useEffect(() => {
    if (entryReplayKey === undefined) return undefined;
    const prev = prevScoreKeyRef.current;
    if (prev === null) {
      prevScoreKeyRef.current = scoreKey;
      return undefined;
    }
    if (prev === scoreKey) return undefined;
    prevScoreKeyRef.current = scoreKey;
    cancelLoop();
    syncLayout();
    tRef.current = 1;
    drawFrame(1);
    return undefined;
  }, [scoreKey, entryReplayKey, syncLayout, drawFrame, cancelLoop]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const ro = new ResizeObserver(() => {
      const t = tRef.current;
      syncLayout();
      drawFrame(Math.min(1, t));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncLayout, drawFrame]);

  return (
    <div className="main-score-style" ref={wrapRef}>
      <canvas ref={canvasRef} className="main-score-style__canvas" aria-hidden />
    </div>
  );
}
