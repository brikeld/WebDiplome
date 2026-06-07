// src/features/liveScoring/ScoreAnimator.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveScoring } from './useLiveScoring.js';
import { PERSONA_TO_SCORE_KEY, SCORE_KEY_TO_RING_ATTR } from './scoringLogic.js';
import './liveScoring.css';

const PERSONA_COLORS = {
  productivity: '#D8D8D8',
  security: '#759AEF',
  popularity: '#CCF847',
  social: '#CCF847',
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

const _counterState = new Map();

function getRingEl(persona) {
  const scoreKey = PERSONA_TO_SCORE_KEY[persona] ?? 'productivity';
  const ringAttr = SCORE_KEY_TO_RING_ATTR[scoreKey] ?? 'productivity';
  return document.querySelector(`[data-persona-ring="${ringAttr}"]`);
}

function animateCounterToTarget(persona, targetValue, onDone, duration = 760) {
  const scoreKey = PERSONA_TO_SCORE_KEY[persona] ?? 'productivity';
  const ringAttr = SCORE_KEY_TO_RING_ATTR[scoreKey] ?? 'productivity';
  const scoreEl = document.querySelector(`[data-persona-ring-score="${ringAttr}"]`);
  if (!scoreEl) {
    onDone?.();
    return;
  }

  const domVal = Number(scoreEl.textContent?.trim()) || 0;
  const startVal = _counterState.has(ringAttr) ? _counterState.get(ringAttr) : domVal;
  const endVal = Math.max(0, Math.min(100, targetValue));
  _counterState.set(ringAttr, endVal);

  const startTime = performance.now();
  function tick(ts) {
    const progress = Math.min((ts - startTime) / duration, 1);
    const t = easeOutCubic(progress);
    scoreEl.textContent = String(Math.round(startVal + (endVal - startVal) * t));
    if (progress < 1) requestAnimationFrame(tick);
    else {
      _counterState.delete(ringAttr);
      onDone?.();
    }
  }
  requestAnimationFrame(tick);
}

function formatHitDeltaText(type, delta) {
  const n = Math.abs(Number(delta));
  if (!Number.isFinite(n) || n === 0) return null;
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  if (type === 'hide') return `-${formatted}%`;
  return `+${formatted}%`;
}

const RING_HIT_DELTA_MS = 6000;
const _ringHitState = new Map();

function showRingHitDelta(persona, type, delta) {
  const text = formatHitDeltaText(type, delta);
  if (!text) return;

  const scoreKey = PERSONA_TO_SCORE_KEY[persona] ?? 'productivity';
  const ringAttr = SCORE_KEY_TO_RING_ATTR[scoreKey] ?? 'productivity';
  const ringEl = getRingEl(persona);
  if (!ringEl) return;

  const mod = type === 'hide' ? 'down' : 'up';
  const prev = _ringHitState.get(ringAttr);
  if (prev) {
    clearTimeout(prev.leaveTimeout);
    clearTimeout(prev.removeTimeout);
    prev.el?.remove();
  }

  const el = document.createElement('span');
  el.className = `lsc-ring-hit-delta lsc-ring-hit-delta--${mod}`;
  el.textContent = text;
  el.setAttribute('aria-live', 'polite');
  ringEl.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('is-visible'));
  });

  const leaveTimeout = setTimeout(() => {
    el.classList.remove('is-visible');
    el.classList.add('is-leaving');
    const removeTimeout = setTimeout(() => {
      el.remove();
      _ringHitState.delete(ringAttr);
    }, 420);
    _ringHitState.set(ringAttr, { leaveTimeout: null, removeTimeout, el: null });
  }, RING_HIT_DELTA_MS);

  _ringHitState.set(ringAttr, { leaveTimeout, removeTimeout: null, el });
}

function commitScoreOnHit(event, { beginRingAnimation, finishRingAnimation, adjustedScoresRef }) {
  const persona = String(event.persona ?? '').toLowerCase();
  const scoreKey = PERSONA_TO_SCORE_KEY[persona] ?? 'productivity';
  const ringAttr = SCORE_KEY_TO_RING_ATTR[scoreKey] ?? 'productivity';

  beginRingAnimation(ringAttr);
  event.onCommit?.();

  if (event.delta != null && Number(event.delta) > 0) {
    showRingHitDelta(persona, event.type, event.delta);
  }

  requestAnimationFrame(() => {
    const target = adjustedScoresRef.current[scoreKey] ?? 0;
    animateCounterToTarget(persona, target, () => {
      finishRingAnimation(adjustedScoresRef.current);
    });
  });
}

function pulseRing(persona) {
  const el = getRingEl(persona);
  if (!el) return;
  el.classList.remove('dashboard-ring-card--pulse');
  void el.offsetWidth;
  el.classList.add('dashboard-ring-card--pulse');
  setTimeout(() => el.classList.remove('dashboard-ring-card--pulse'), 920);
}

const TARGET_PULSE_MS = 980;

export function getParticleFlightPlan({
  isHide,
  isReveal,
  isLeaderboardHide,
  isLeaderboardReveal,
  hasWaypoint = false,
}) {
  const startDelay = hasWaypoint && isHide && !isReveal
    ? 40
    : isHide
      ? 120
      : 0;

  const duration = isLeaderboardHide || isLeaderboardReveal
    ? 1120
    : hasWaypoint && isHide && !isReveal
      ? 1080
      : isHide || isReveal
        ? 920
        : 760;

  return {
    duration,
    startDelay,
    waypoint: hasWaypoint && isHide && !isReveal
      ? {
          hitEnd: isLeaderboardHide ? 0.3 : 0.28,
          holdEnd: isLeaderboardHide ? 0.5 : 0.44,
        }
      : {
          hitEnd: 0.42,
          holdEnd: 0.42,
        },
  };
}

function rectContainsPoint(rect, x, y) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function findPostCardByRect(sourceRect) {
  const cx = sourceRect.x + sourceRect.width / 2;
  const cy = sourceRect.y + sourceRect.height / 2;
  for (const card of document.querySelectorAll('.post-card')) {
    const rect = card.getBoundingClientRect();
    if (rectContainsPoint(rect, cx, cy)) return card;
  }
  return null;
}

function findLeaderboardSelfRowByRect(sourceRect) {
  const cx = sourceRect.x + sourceRect.width / 2;
  const cy = sourceRect.y + sourceRect.height / 2;
  for (const row of document.querySelectorAll('.leaderboard-row--self')) {
    const rect = row.getBoundingClientRect();
    if (rectContainsPoint(rect, cx, cy)) return row;
  }
  return document.querySelector('.leaderboard-row--self');
}

function pulseTargetEl(el, className = 'lsc-target-pulse') {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), TARGET_PULSE_MS);
}

function pulseRevealTarget(sourceRect, variant, event, className = 'lsc-target-pulse') {
  if (!sourceRect) return;
  const persona = String(event.persona ?? '').toLowerCase();
  const accent = PERSONA_COLORS[persona] ?? '#759AEF';

  if (variant === 'leaderboard-self') {
    const row = findLeaderboardSelfRowByRect(sourceRect);
    if (!row) return;
    row.style.setProperty('--hit-accent', accent);
    pulseTargetEl(row, className);
    const header = row.querySelector('.leaderboard-row__header') ?? row;
    return;
  }

  const card = findPostCardByRect(sourceRect);
  if (!card) return;
  const capsule = card.querySelector('.post-unified-capsule');
  if (!capsule) return;
  const accentFromCard = getComputedStyle(card).getPropertyValue('--post-accent').trim();
  capsule.style.setProperty('--hit-accent', accentFromCard || accent);
  pulseTargetEl(capsule, className);
}

function Particle({ event, onComplete, scoringApi }) {
  const elRef = useRef(null);
  const isHide = event.type === 'hide';
  const isReveal = event.type === 'reveal';
  const isLeaderboardHide = isHide && event.variant === 'leaderboard-self';
  const isLeaderboardReveal = isReveal && event.variant === 'leaderboard-self';
  const particleSize = isHide || isReveal ? 32 : 18;

  useEffect(() => {
    const { sourcePillRect, persona } = event;
    if (!sourcePillRect) {
      commitScoreOnHit(event, scoringApi);
      event.onAnimationComplete?.();
      onComplete();
      return;
    }

    const ringEl = getRingEl(persona);
    const targetRect = ringEl?.getBoundingClientRect();
    if (!targetRect) {
      commitScoreOnHit(event, scoringApi);
      event.onAnimationComplete?.();
      onComplete();
      return;
    }

    const postX = sourcePillRect.x + sourcePillRect.width / 2;
    const postY = sourcePillRect.y + sourcePillRect.height / 2;
    const ringX = targetRect.x + targetRect.width / 2;
    const ringY = targetRect.y + targetRect.height / 2;
    const waypointRect = !isReveal && event.waypointRect ? event.waypointRect : null;
    const waypointX = waypointRect ? waypointRect.x + waypointRect.width / 2 : null;
    const waypointY = waypointRect ? waypointRect.y + waypointRect.height / 2 : null;
    const sx = isReveal ? ringX : postX;
    const sy = isReveal ? ringY : postY;
    const tx = isReveal ? postX : ringX;
    const ty = isReveal ? postY : ringY;
    const dx = tx - sx;
    const dy = ty - sy;
    const arcHeight = -Math.min(Math.abs(dx) * 0.58, 220) - 90;

    const flightPlan = getParticleFlightPlan({
      isHide,
      isReveal,
      isLeaderboardHide,
      isLeaderboardReveal,
      hasWaypoint: Boolean(waypointRect),
    });
    const DURATION = flightPlan.duration;
    const START_DELAY = flightPlan.startDelay;
    const startTime = performance.now() + START_DELAY;

    const el = elRef.current;
    if (!el) {
      commitScoreOnHit(event, scoringApi);
      event.onAnimationComplete?.();
      onComplete();
      return;
    }

    if (isReveal) {
      pulseRing(persona);
      commitScoreOnHit(event, scoringApi);
    }

    let waypointCommitted = false;
    function step(ts) {
      if (ts < startTime) {
        el.style.left = `${sx - particleSize / 2}px`;
        el.style.top = `${sy - particleSize / 2}px`;
        el.style.opacity = '1';
        requestAnimationFrame(step);
        return;
      }

      const raw = (ts - startTime) / DURATION;
      const progress = Math.max(0, Math.min(raw, 1));
      const t = easeOutCubic(progress);

      let x;
      let y;
      if (waypointRect && waypointX != null && waypointY != null) {
        const hitEnd = flightPlan.waypoint.hitEnd;
        const holdEnd = flightPlan.waypoint.holdEnd;
        if (progress < hitEnd) {
          const legProgress = progress / hitEnd;
          const legT = easeOutCubic(legProgress);
          x = sx + (waypointX - sx) * legT;
          y = sy + (waypointY - sy) * legT - Math.sin(Math.PI * legProgress) * 54;
          el.classList.remove('lsc-particle--impacting');
        } else if (progress < holdEnd) {
          if (!waypointCommitted) {
            waypointCommitted = true;
            event.onWaypoint?.();
            pulseRevealTarget(waypointRect, event.variant, event, 'lsc-target-pulse--hide-hit');
          }
          const holdProgress = (progress - hitEnd) / Math.max(holdEnd - hitEnd, 0.001);
          x = waypointX + Math.sin(holdProgress * Math.PI * 2) * 4;
          y = waypointY - Math.sin(Math.PI * holdProgress) * 10;
          el.classList.add('lsc-particle--impacting');
        } else {
          if (!waypointCommitted) {
            waypointCommitted = true;
            event.onWaypoint?.();
            pulseRevealTarget(waypointRect, event.variant, event, 'lsc-target-pulse--hide-hit');
          }
          el.classList.remove('lsc-particle--impacting');
          const legProgress = (progress - holdEnd) / Math.max(1 - holdEnd, 0.001);
          const legT = easeOutCubic(legProgress);
          x = waypointX + (tx - waypointX) * legT;
          y =
            waypointY +
            (ty - waypointY) * legT -
            Math.sin(Math.PI * legProgress) * Math.min(Math.abs(tx - waypointX) * 0.48 + 64, 220);
        }
      } else {
        x = sx + dx * t;
        const arcY = arcHeight * Math.sin(Math.PI * progress);
        y = sy + dy * t + arcY;
      }

      const opacity = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;

      el.style.left = `${x - particleSize / 2}px`;
      el.style.top = `${y - particleSize / 2}px`;
      el.style.opacity = String(opacity);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        if (!isReveal) {
          pulseRing(persona);
          commitScoreOnHit(event, scoringApi);
        } else {
          el.style.opacity = '0';
          pulseRevealTarget(sourcePillRect, event.variant, event);
        }
        event.onAnimationComplete?.();
        onComplete();
      }
    }

    requestAnimationFrame(step);
  }, []);

  const color = PERSONA_COLORS[event.persona] ?? '#fff';
  const sourceRect = event.sourcePillRect;
  const initialRingRect = isReveal ? getRingEl(event.persona)?.getBoundingClientRect() : null;
  const initialCenterX =
    isReveal && initialRingRect
      ? initialRingRect.x + initialRingRect.width / 2
      : sourceRect
        ? sourceRect.x + sourceRect.width / 2
        : -100;
  const initialCenterY =
    isReveal && initialRingRect
      ? initialRingRect.y + initialRingRect.height / 2
      : sourceRect
        ? sourceRect.y + sourceRect.height / 2
        : -100;
  const deltaLabel =
    event.delta != null && Number.isFinite(Number(event.delta))
      ? formatHitDeltaText(event.type, event.delta)
      : null;
  const className = [
    'lsc-particle',
    `lsc-particle--${event.type}`,
    isLeaderboardHide ? 'lsc-particle--leaderboard-hide' : '',
    isLeaderboardReveal ? 'lsc-particle--leaderboard-reveal' : '',
  ].filter(Boolean).join(' ');
  const redactionRect = isLeaderboardHide && event.waypointRect ? event.waypointRect : sourceRect;

  return (
    <>
      {(isLeaderboardHide || isLeaderboardReveal) && redactionRect ? (
        <div
          className={
            isLeaderboardReveal
              ? 'lsc-leaderboard-blur-redaction lsc-leaderboard-blur-redaction--reveal'
              : 'lsc-leaderboard-blur-redaction'
          }
          style={{
            '--lsc-color': color,
            left: `${redactionRect.x}px`,
            top: `${redactionRect.y}px`,
            width: `${redactionRect.width}px`,
            height: `${redactionRect.height}px`,
          }}
          aria-hidden
        >
          <span className="lsc-leaderboard-blur-redaction__avatar" />
          <span className="lsc-leaderboard-blur-redaction__name" />
        </div>
      ) : null}
      <div
        ref={elRef}
        className={className}
        style={{
          '--lsc-color': color,
          background: color,
          boxShadow: `0 0 26px 9px ${color}cc, 0 0 70px 24px ${color}55`,
          opacity: 1,
          left: `${initialCenterX - particleSize / 2}px`,
          top: `${initialCenterY - particleSize / 2}px`,
        }}
      >
        <span className="lsc-particle__shock lsc-particle__shock--outer" aria-hidden />
        <span className="lsc-particle__shock lsc-particle__shock--inner" aria-hidden />
        {deltaLabel ? <span className="lsc-particle__label">{deltaLabel}</span> : null}
      </div>
    </>
  );
}

function PersonaFlipOverlay({ persona, onComplete }) {
  const color = PERSONA_COLORS[persona] ?? '#fff';

  useEffect(() => {
    const timer = setTimeout(onComplete, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="lsc-persona-flip-overlay"
      style={{ '--lsc-flip-color': color }}
      aria-hidden
    />
  );
}

export default function ScoreAnimator() {
  const {
    subscribeAnimations,
    dequeueAnimation,
    dominantPersona,
    scoresLoaded,
    adjustedScoresRef,
    beginRingAnimation,
    finishRingAnimation,
  } = useLiveScoring();
  const scoringApi = useMemo(
    () => ({ beginRingAnimation, finishRingAnimation, adjustedScoresRef }),
    [beginRingAnimation, finishRingAnimation, adjustedScoresRef],
  );
  const [particles, setParticles] = useState([]);
  const [flipOverlay, setFlipOverlay] = useState(null);
  const prevDominantPersonaRef = useRef(null);
  const flipBaselineReadyRef = useRef(false);

  useEffect(() => {
    const unsub = subscribeAnimations((queue) => {
      if (!queue.length) return;
      setParticles((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const incoming = queue.filter((e) => !seen.has(e.id));
        return incoming.length ? [...prev, ...incoming] : prev;
      });
      for (const event of queue) {
        dequeueAnimation(event.id);
      }
    });
    return unsub;
  }, [subscribeAnimations, dequeueAnimation]);

  useEffect(() => {
    if (!scoresLoaded) {
      flipBaselineReadyRef.current = false;
      return;
    }
    if (!flipBaselineReadyRef.current) {
      flipBaselineReadyRef.current = true;
      prevDominantPersonaRef.current = dominantPersona;
      return;
    }
    if (prevDominantPersonaRef.current !== dominantPersona) {
      setFlipOverlay({ id: Date.now(), persona: dominantPersona });
    }
    prevDominantPersonaRef.current = dominantPersona;
  }, [dominantPersona, scoresLoaded]);

  return createPortal(
    <>
      {particles.map((event) => (
        <Particle
          key={event.id}
          event={event}
          scoringApi={scoringApi}
          onComplete={() => setParticles((prev) => prev.filter((p) => p.id !== event.id))}
        />
      ))}
      {flipOverlay && (
        <PersonaFlipOverlay
          key={flipOverlay.id}
          persona={flipOverlay.persona}
          onComplete={() => setFlipOverlay(null)}
        />
      )}
    </>,
    document.body,
  );
}
