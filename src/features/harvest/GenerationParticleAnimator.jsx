import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GENERATION_PARTICLE_BURST_MS,
  GENERATION_PARTICLE_DEMO_FLIGHT_MS,
  GENERATION_PARTICLE_EVENT,
  GENERATION_PARTICLE_FLIGHT_MS,
  GENERATION_PARTICLE_SIZE,
  computeDemoParticleFrame,
  computeGenerationParticleFrame,
  personaUiColorForParticle,
} from '@/lib/generationParticleFlight.js';
import '@/features/liveScoring/liveScoring.css';

const SIZE = GENERATION_PARTICLE_SIZE;

/**
 * A persona-colored sphere flies to the reserved feed slot, then bursts once on
 * landing. Two variants share the same sphere + burst styling:
 *  - `generation`: lobs from the dashboard generating row (your own post).
 *  - `demo`: descends from the top of the feed (a post from another user).
 * The flight is driven by rAF (left/top only); the impact pop + shockwave are
 * CSS animations on `--impacting`. The flight resolves at the moment of impact,
 * so the new post materializes from the burst.
 */
function GenerationParticle({ flight, onDone }) {
  const elRef = useRef(null);
  const color = personaUiColorForParticle(flight.persona);
  const isDemo = flight.variant === 'demo';
  const computeFrame = isDemo ? computeDemoParticleFrame : computeGenerationParticleFrame;
  const flightMs = isDemo ? GENERATION_PARTICLE_DEMO_FLIGHT_MS : GENERATION_PARTICLE_FLIGHT_MS;
  const sx = flight.sourceRect.x + flight.sourceRect.width / 2;
  const sy = flight.sourceRect.y + flight.sourceRect.height / 2;

  useEffect(() => {
    const el = elRef.current;
    if (!el) {
      flight.resolve?.();
      onDone(flight.id);
      return undefined;
    }

    let rafId = 0;
    let removeTimer = 0;
    const startTime = performance.now();

    const placeAt = (x, y) => {
      el.style.left = `${x - SIZE / 2}px`;
      el.style.top = `${y - SIZE / 2}px`;
    };

    const land = () => {
      const tx = flight.targetRect.x + flight.targetRect.width / 2;
      const ty = flight.targetRect.y + flight.targetRect.height / 2;
      placeAt(tx, ty);
      el.classList.add('lsc-particle--impacting'); // CSS plays the burst
      flight.resolve?.(); // post materializes at impact
      removeTimer = window.setTimeout(() => onDone(flight.id), GENERATION_PARTICLE_BURST_MS);
    };

    const step = (ts) => {
      const progress = Math.min((ts - startTime) / flightMs, 1);
      const { x, y } = computeFrame({
        progress,
        sourceRect: flight.sourceRect,
        targetRect: flight.targetRect,
      });
      placeAt(x, y);
      if (progress < 1) rafId = requestAnimationFrame(step);
      else land();
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(removeTimer);
    };
  }, [flight, onDone, computeFrame, flightMs]);

  return (
    <div
      ref={elRef}
      className="lsc-particle lsc-particle--generation"
      style={{
        '--lsc-color': color,
        '--burst-ms': `${GENERATION_PARTICLE_BURST_MS}ms`,
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        background: color,
        boxShadow: `0 0 26px 9px ${color}cc, 0 0 70px 24px ${color}55`,
        left: `${sx - SIZE / 2}px`,
        top: `${sy - SIZE / 2}px`,
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
          variant: detail.variant === 'demo' ? 'demo' : 'generation',
          sourceRect: detail.sourceRect,
          targetRect: detail.targetRect,
          resolve: detail.resolve,
        },
      ]);
    };

    window.addEventListener(GENERATION_PARTICLE_EVENT, onFlight);
    return () => window.removeEventListener(GENERATION_PARTICLE_EVENT, onFlight);
  }, []);

  // Stable across renders so adding a 2nd particle never restarts the 1st's
  // flight effect mid-air.
  const handleDone = useCallback((id) => {
    setFlights((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  if (flights.length === 0) return null;

  return createPortal(
    <>
      {flights.map((flight) => (
        <GenerationParticle key={flight.id} flight={flight} onDone={handleDone} />
      ))}
    </>,
    document.body,
  );
}
