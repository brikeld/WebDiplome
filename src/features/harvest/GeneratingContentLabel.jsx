import { useEffect, useMemo, useRef, useState } from 'react';
import { shuffledTextsForPersona } from './generatingPhrases.js';
import { personaUiColor } from '@/lib/personaColors.js';

const PHRASE_INTERVAL_MS = 2200;
/** Keep in sync with `post-reveal-flash` animation in base.css. */
const REVEAL_FLASH_MS = 1100;

const GENERATING_BAR_ROWS = [
  { key: 'productivity', persona: 'productivite', color: '#D8D8D8' },
  { key: 'security', persona: 'securite', color: '#759AEF' },
  { key: 'social', persona: 'popularite', color: '#CCF847' },
];

/** Normalize any persona spelling (FR/EN) to the row key used above. */
function personaToRowKey(persona) {
  const k = String(persona ?? '').toLowerCase();
  if (k.startsWith('prod')) return 'productivity';
  if (k.startsWith('sec')) return 'security';
  if (k.startsWith('pop') || k === 'social') return 'social';
  return null;
}

export function GeneratingEllipsis() {
  return (
    <span className="generating-ellipsis" aria-hidden="true">
      <span className="generating-ellipsis__dot">.</span>
      <span className="generating-ellipsis__dot">.</span>
      <span className="generating-ellipsis__dot">.</span>
    </span>
  );
}

function GeneratingBarRow({ persona, color, flashing, rowKey, active = false }) {
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
    <div
      className={`update-gen-row${flashing ? ' update-gen-row--posted' : ''}${active ? ' update-gen-row--active' : ''}`}
      data-gen-persona={rowKey}
      style={{ '--gen-bar-color': color }}
    >
      <p key={phraseIndex} className="update-gen-row__phrase">
        {phrase}
      </p>
      <div className="update-gen-row__track" aria-hidden>
        <div className="update-gen-row__shimmer" />
      </div>
    </div>
  );
}

export default function GeneratingContentLabel({ revealFlash = null, activePersona = null }) {
  const nonce = revealFlash?.nonce ?? 0;
  // Latch the active flash (persona + color + key) on each nonce bump, then
  // clear after the animation so the accent pulse can retrigger cleanly.
  const [activeFlash, setActiveFlash] = useState(null);
  const clearTimerRef = useRef(null);

  useEffect(() => {
    if (!nonce) return undefined;
    const rowKey = personaToRowKey(revealFlash?.persona);
    setActiveFlash({ key: rowKey, color: personaUiColor(revealFlash?.persona), nonce });
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setActiveFlash(null);
      clearTimerRef.current = null;
    }, REVEAL_FLASH_MS);
    return undefined;
    // Only react to nonce changes (persona is read fresh each bump).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useEffect(
    () => () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    },
    [],
  );

  const activeRowKey = personaToRowKey(activePersona);

  return (
    <div
      className="update-flow update-flow--generating"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Generating content"
    >
      {activeFlash ? (
        <span
          key={activeFlash.nonce}
          className="update-flow__post-flash"
          style={{ '--flash-color': activeFlash.color }}
          aria-hidden
        />
      ) : null}
      <h3 className="update-flow__generating-title">
        Generating content
        <GeneratingEllipsis />
      </h3>
      <div className="update-flow__gen-rows">
        {GENERATING_BAR_ROWS.map(({ key, persona, color }) => (
          <GeneratingBarRow
            key={key}
            persona={persona}
            color={color}
            flashing={activeFlash?.key === key}
            rowKey={key}
            active={activeRowKey === key}
          />
        ))}
      </div>
    </div>
  );
}
