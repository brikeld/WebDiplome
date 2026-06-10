import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GENERATION_PARTICLE_DURATION_MS,
  GENERATION_PARTICLE_EVENT,
  GENERATION_PARTICLE_IMPACT_PROGRESS,
  GENERATION_PARTICLE_SIZE,
  computeGenerationParticleFrame,
  personaUiColorForParticle,
} from '@/lib/generationParticleFlight.js';
import '@/features/liveScoring/liveScoring.css';

const TARGET_PULSE_MS = 980;

function pulseFeedRevealTarget(targetRect, color) {
  const target = document.querySelector('[data-feed-reveal-target]');
  if (target) {
    target.style.setProperty('--hit-accent', color);
    target.classList.remove('lsc-target-pulse');
    void target.offsetWidth;
    target.classList.add('lsc-target-pulse');
    window.setTimeout(() => target.classList.remove('lsc-target-pulse'), TARGET_PULSE_MS);
    return;
  }

  const shell = document.querySelector('.post-card-shell');
  if (shell) {
    shell.style.setProperty('--hit-accent', color);
    shell.classList.remove('lsc-target-pulse');
    void shell.offsetWidth;
    shell.classList.add('lsc-target-pulse');
    window.setTimeout(() => shell.classList.remove('lsc-target-pulse'), TARGET_PULSE_MS);
    return;
  }

  if (!targetRect) return;
  const ghost = document.createElement('span');
  ghost.className = 'generation-particle-target-ghost lsc-target-pulse';
  ghost.style.setProperty('--hit-accent', color);
  ghost.style.left = `${targetRect.x + targetRect.width / 2}px`;
  ghost.style.top = `${targetRect.y + targetRect.height / 2}px`;
  document.body.appendChild(ghost);
  window.setTimeout(() => ghost.remove(), TARGET_PULSE_MS);
}

function GenerationParticle({ flight, onDone }) {
  const elRef = useRef(null);
  const color = personaUiColorForParticle(flight.persona);
  const size = GENERATION_PARTICLE_SIZE;
  const sx = flight.sourceRect.x + flight.sourceRect.width / 2;
  const sy = flight.sourceRect.y + flight.sourceRect.height / 2;

  useEffect(() => {
    const el = elRef.current;
    if (!el) {
      flight.resolve?.();
      onDone();
      return undefined;
    }

    const startTime = performance.now();
    let impacted = false;

    function step(ts) {
      const raw = (ts - startTime) / GENERATION_PARTICLE_DURATION_MS;
      const progress = Math.max(0, Math.min(raw, 1));
      const { x, y, opacity } = computeGenerationParticleFrame({
        progress,
        sourceRect: flight.sourceRect,
        targetRect: flight.targetRect,
      });

      el.style.left = `${x - size / 2}px`;
      el.style.top = `${y - size / 2}px`;
      el.style.opacity = String(opacity);

      // Fire impact at the designated threshold — particle still fully visible here.
      // Resolving the promise lets the post reveal begin while the burst plays out.
      if (!impacted && progress >= GENERATION_PARTICLE_IMPACT_PROGRESS) {
        impacted = true;
        el.classList.add('lsc-particle--impacting');
        pulseFeedRevealTarget(flight.targetRect, color);
        flight.resolve?.();
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.style.opacity = '0';
        onDone();
      }
    }

    requestAnimationFrame(step);
    return undefined;
  }, [color, flight, onDone, size]);

  return (
    <div
      ref={elRef}
      className="lsc-particle lsc-particle--reveal lsc-particle--generation"
      style={{
        '--lsc-color': color,
        background: color,
        boxShadow: `0 0 26px 9px ${color}cc, 0 0 70px 24px ${color}55`,
        opacity: 1,
        left: `${sx - size / 2}px`,
        top: `${sy - size / 2}px`,
      }}
      aria-hidden
    >
      <span className="lsc-particle__shock lsc-particle__shock--outer" aria-hidden />
      <span className="lsc-particle__shock lsc-particle__shock--inner" aria-hidden />
    </div>
  );
}

export default function GenerationParticleAnimator() {
  const [flights, setFlights] = useState([]);

  useEffect(() => {
    const onFlight = (event) => {
      const detail = event?.detail;
      if (!detail?.sourceRect || !detail?.targetRect) {
        detail?.resolve?.();
        return;
      }
      setFlights((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          persona: detail.persona ?? null,
          sourceRect: detail.sourceRect,
          targetRect: detail.targetRect,
          resolve: detail.resolve,
        },
      ]);
    };

    window.addEventListener(GENERATION_PARTICLE_EVENT, onFlight);
    return () => window.removeEventListener(GENERATION_PARTICLE_EVENT, onFlight);
  }, []);

  if (flights.length === 0) return null;

  return createPortal(
    <>
      {flights.map((flight) => (
        <GenerationParticle
          key={flight.id}
          flight={flight}
          onDone={() => setFlights((prev) => prev.filter((entry) => entry.id !== flight.id))}
        />
      ))}
    </>,
    document.body,
  );
}
