import { useEffect, useMemo, useState } from 'react';
import { HARVEST_PHRASES, shuffledHarvestPhrases } from './harvestPhrases.js';

const PHRASE_INTERVAL_MS = 2200;

/**
 * Harvest progress — rotating phrase + simple progress bar.
 */
export default function HarvestScreen({ progress, error }) {
  const rawPct = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
  // Server tops at 95 during analyze; cap 100 if a stray progress push arrives early.
  const pct = rawPct >= 100 ? 95 : rawPct;

  const phrases = useMemo(
    () => (HARVEST_PHRASES.length > 0 ? shuffledHarvestPhrases() : []),
    [],
  );
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (phrases.length <= 1) return undefined;
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % phrases.length);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phrases.length]);

  const phraseText = phrases[phraseIndex] ?? 'Initializing system scan';

  if (error) {
    return (
      <div className="update-flow update-flow--harvest update-flow--error" role="alert">
        <p className="update-flow__error">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="update-flow update-flow--harvest"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`Harvesting: ${phraseText}`}
    >
      <p key={phraseIndex} className="update-flow__harvest-phrase">
        {phraseText}
      </p>
      <div className="update-flow__harvest-foot">
        <span className="update-flow__harvest-label">Data harvesting</span>
        <span className="update-flow__harvest-pct">{pct}%</span>
      </div>
      <div className="update-flow__track" aria-hidden>
        <div className="update-flow__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
