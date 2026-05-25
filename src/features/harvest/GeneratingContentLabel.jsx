import { useEffect, useMemo, useState } from 'react';
import {
  GENERATING_PHRASES,
  PERSONA_DISPLAY_LABEL,
  shufflePhrases,
} from './generatingPhrases.js';

const PHRASE_INTERVAL_MS = 1800;

export function GeneratingEllipsis() {
  return (
    <span className="generating-ellipsis" aria-hidden="true">
      <span className="generating-ellipsis__dot">.</span>
      <span className="generating-ellipsis__dot">.</span>
      <span className="generating-ellipsis__dot">.</span>
    </span>
  );
}

export default function GeneratingContentLabel() {
  // Shuffle once per mount so the user sees a different order each generation.
  const phrases = useMemo(
    () => (GENERATING_PHRASES.length > 0 ? shufflePhrases(GENERATING_PHRASES) : []),
    [],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (phrases.length <= 1) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % phrases.length);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phrases.length]);

  const phrase = phrases[index] ?? { persona: 'productivite', text: 'generating new content' };
  const personaLabel = PERSONA_DISPLAY_LABEL[phrase.persona] ?? 'Social';

  return (
    <div
      className="generating-content-block"
      role="status"
      aria-live="polite"
      aria-label={`${personaLabel}: ${phrase.text}`}
    >
      <p
        // `key` on the persona tag + label triggers the fade animation each
        // time the phrase swaps. Without it, the element is reused and the
        // CSS animation never re-runs.
        key={index}
        className="generating-content-line"
      >
        <span
          className="generating-content-tag"
          data-persona={phrase.persona}
        >
          [{personaLabel}]
        </span>
        <span className="generating-content-text">
          {phrase.text}
          <GeneratingEllipsis />
        </span>
      </p>
    </div>
  );
}
