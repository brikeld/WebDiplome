const PERSONA_DELTA_CARDS = [
  { key: 'productivity', scoreKey: 'productivity', color: '#D8D8D8' },
  { key: 'security', scoreKey: 'security', color: '#759AEF' },
  { key: 'social', scoreKey: 'social', color: '#CCF847' },
];

function formatDelta(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n)) return '—';
  if (n > 0) return `+${n}%`;
  if (n < 0) return `${n}%`;
  return '=';
}

function deltaMod(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

function personaToDeltaKey(personaKey) {
  const k = String(personaKey ?? '').toLowerCase();
  if (k === 'popularity' || k === 'popularite' || k === 'social') return 'social';
  if (k === 'productivity' || k === 'productivite') return 'productivity';
  if (k === 'security' || k === 'securite') return 'security';
  return 'security';
}

function orderCards(dominantPersona) {
  const mainKey = personaToDeltaKey(dominantPersona);
  const main = PERSONA_DELTA_CARDS.find((c) => c.key === mainKey) ?? PERSONA_DELTA_CARDS[1];
  const others = PERSONA_DELTA_CARDS.filter((c) => c.key !== main.key);
  if (others.length !== 2) return PERSONA_DELTA_CARDS;
  return [others[0], main, others[1]];
}

export default function PersonaDeltaSummary({ deltas, scores: _scores, dominantPersona = 'security' }) {
  if (!deltas) return null;

  const cards = orderCards(dominantPersona);
  const mainKey = personaToDeltaKey(dominantPersona);

  return (
    <div className="update-flow update-flow--deltas" role="status" aria-live="polite">
      <div className="update-flow__delta-grid">
        {cards.map(({ key, scoreKey, color }) => {
          const delta = deltas[key];
          const isMain = key === mainKey;
          return (
            <article
              key={key}
              className={`persona-delta-card update-delta-col${isMain ? ' update-delta-col--main persona-delta-card--main' : ''}`}
              style={{ '--delta-card-color': color }}
              aria-label={`${key} ${formatDelta(delta)}`}
            >
              <span
                className={`update-delta-col__value persona-delta-card__delta persona-delta-card__delta--${deltaMod(delta)}`}
              >
                {formatDelta(delta)}
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
