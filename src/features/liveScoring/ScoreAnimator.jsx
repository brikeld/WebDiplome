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

function animateCounterToTarget(persona, targetValue, onDone, duration = 520) {
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

  const flashClass = endVal < startVal ? 'lsc-score-flash-down' : 'lsc-score-flash-up';
  scoreEl.classList.remove('lsc-score-flash-down', 'lsc-score-flash-up');
  void scoreEl.offsetWidth;
  scoreEl.classList.add(flashClass);
  setTimeout(() => scoreEl.classList.remove(flashClass), duration + 100);

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

function commitScoreOnHit(event, { beginRingAnimation, finishRingAnimation, adjustedScoresRef }) {
  const persona = String(event.persona ?? '').toLowerCase();
  const scoreKey = PERSONA_TO_SCORE_KEY[persona] ?? 'productivity';
  const ringAttr = SCORE_KEY_TO_RING_ATTR[scoreKey] ?? 'productivity';

  beginRingAnimation(ringAttr);
  event.onCommit?.();

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
  setTimeout(() => el.classList.remove('dashboard-ring-card--pulse'), 460);
}

function Particle({ event, onComplete, scoringApi }) {
  const elRef = useRef(null);

  useEffect(() => {
    const { sourcePillRect, persona } = event;
    if (!sourcePillRect) {
      commitScoreOnHit(event, scoringApi);
      onComplete();
      return;
    }

    const ringEl = getRingEl(persona);
    const targetRect = ringEl?.getBoundingClientRect();
    if (!targetRect) {
      commitScoreOnHit(event, scoringApi);
      onComplete();
      return;
    }

    const sx = sourcePillRect.x + sourcePillRect.width / 2;
    const sy = sourcePillRect.y + sourcePillRect.height / 2;
    const tx = targetRect.x + targetRect.width / 2;
    const ty = targetRect.y + targetRect.height / 2;
    const dx = tx - sx;
    const dy = ty - sy;
    const arcHeight = -Math.min(Math.abs(dx) * 0.45, 140) - 50;

    const DURATION = 680;
    const startTime = performance.now();

    const el = elRef.current;
    if (!el) {
      commitScoreOnHit(event, scoringApi);
      onComplete();
      return;
    }

    function step(ts) {
      const raw = (ts - startTime) / DURATION;
      const progress = Math.min(raw, 1);
      const t = easeOutCubic(progress);

      const x = sx + dx * t;
      const arcY = arcHeight * Math.sin(Math.PI * progress);
      const y = sy + dy * t + arcY;

      const opacity = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;

      el.style.left = `${x - 5.5}px`;
      el.style.top = `${y - 5.5}px`;
      el.style.opacity = String(opacity);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        pulseRing(persona);
        commitScoreOnHit(event, scoringApi);
        onComplete();
      }
    }

    requestAnimationFrame(step);
  }, []);

  const color = PERSONA_COLORS[event.persona] ?? '#fff';
  return (
    <div
      ref={elRef}
      className="lsc-particle"
      style={{
        background: color,
        boxShadow: `0 0 14px 5px ${color}99`,
        opacity: event.type === 'reveal' ? 0.55 : 1,
        left: event.sourcePillRect ? `${event.sourcePillRect.x + event.sourcePillRect.width / 2 - 5.5}px` : '-100px',
        top: event.sourcePillRect ? `${event.sourcePillRect.y + event.sourcePillRect.height / 2 - 5.5}px` : '-100px',
      }}
    />
  );
}

function PersonaFlipOverlay({ persona, onComplete }) {
  const ringEl = getRingEl(persona);
  const rect = ringEl?.getBoundingClientRect();
  const cx = rect ? rect.x + rect.width / 2 : window.innerWidth * 0.85;
  const cy = rect ? rect.y + rect.height / 2 : window.innerHeight / 2;
  const color = PERSONA_COLORS[persona] ?? '#fff';

  useEffect(() => {
    const timer = setTimeout(onComplete, 960);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="lsc-persona-flip-overlay"
      style={{
        background: `radial-gradient(circle at ${cx}px ${cy}px, ${color}cc 0%, ${color}44 30%, transparent 65%)`,
      }}
    />
  );
}

export default function ScoreAnimator() {
  const {
    subscribeAnimations,
    dequeueAnimation,
    dominantPersona,
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
  const prevDominantPersonaRef = useRef(dominantPersona);

  useEffect(() => {
    const unsub = subscribeAnimations((queue) => {
      if (!queue.length) return;
      const latest = queue[queue.length - 1];
      setParticles((prev) => [...prev, latest]);
      dequeueAnimation(latest.id);
    });
    return unsub;
  }, [subscribeAnimations, dequeueAnimation]);

  useEffect(() => {
    if (prevDominantPersonaRef.current !== dominantPersona) {
      setFlipOverlay({ id: Date.now(), persona: dominantPersona });
    }
    prevDominantPersonaRef.current = dominantPersona;
  }, [dominantPersona]);

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
