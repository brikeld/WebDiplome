import { useEffect, useMemo, useState } from 'react';
import { shuffledTextsForPersona } from './generatingPhrases.js';

const PHRASE_INTERVAL_MS = 2200;

const GENERATING_BAR_ROWS = [
  { key: 'productivity', persona: 'productivite', color: '#D8D8D8' },
  { key: 'security', persona: 'securite', color: '#759AEF' },
  { key: 'social', persona: 'popularite', color: '#CCF847' },
];

export function GeneratingEllipsis() {
  return (
    <span className="generating-ellipsis" aria-hidden="true">
      <span className="generating-ellipsis__dot">.</span>
      <span className="generating-ellipsis__dot">.</span>
      <span className="generating-ellipsis__dot">.</span>
    </span>
  );
}

function GeneratingBarRow({ persona, color, personaKey }) {
  const phrases = useMemo(() => shuffledTextsForPersona(persona), [persona]);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (phrases.length <= 1) return undefined;
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % phrases.length);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phrases.length]);

  const phrase = phrases[phraseIndex] ?? phrases[0] ?? 'Generating';

  return (
    <div className="update-gen-row" data-gen-persona={personaKey} style={{ '--gen-bar-color': color }}>
      <p key={phraseIndex} className="update-gen-row__phrase">
        {phrase}
      </p>
      <div className="update-gen-row__track" aria-hidden>
        <div className="update-gen-row__shimmer" />
      </div>
    </div>
  );
}

export default function GeneratingContentLabel() {
  return (
    <div
      className="update-flow update-flow--generating"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Generating content"
    >
      <h3 className="update-flow__generating-title">
        Generating content
        <GeneratingEllipsis />
      </h3>
      <div className="update-flow__gen-rows">
        {GENERATING_BAR_ROWS.map(({ key, persona, color }) => (
          <GeneratingBarRow key={key} persona={persona} color={color} personaKey={key} />
        ))}
      </div>
    </div>
  );
}
