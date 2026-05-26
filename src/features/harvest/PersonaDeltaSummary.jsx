const PERSONA_DELTA_CARDS = [
  {
    key: 'productivity',
    scoreKey: 'productivity',
    label: 'productivity',
    color: '#D8D8D8',
  },
  {
    key: 'security',
    scoreKey: 'security',
    label: 'security',
    color: '#759AEF',
  },
  {
    key: 'social',
    scoreKey: 'social',
    label: 'social',
    color: '#CCF847',
  },
];

function formatDelta(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n)) return '—';
  if (n > 0) return `+${n}`;
  if (n < 0) return String(n);
  return '=';
}

function deltaMod(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

function deltaOutcome(delta, label) {
  const n = Number(delta);
  const suffix = label ? ` in ${label}` : '';
  if (!Number.isFinite(n) || n === 0) return `ur score${suffix} has stayed the same`;
  if (n > 0) return `ur score${suffix} has improved`;
  return `ur score${suffix} has decreased`;
}

function formatScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function PersonaDeltaSummary({ deltas, scores }) {
  if (!deltas) return null;

  return (
    <div className="persona-delta-summary" role="status" aria-live="polite">
      <div className="persona-delta-summary__grid">
        {PERSONA_DELTA_CARDS.map(({ key, scoreKey, label, color }, i) => {
          const score = formatScore(scores?.[scoreKey]);
          const delta = deltas[key];
          return (
            <article
              key={key}
              className={`persona-delta-card persona-delta-card--${key}${
                i === 0 ? ' persona-delta-card--main' : ''
              }`}
              style={{ '--delta-card-color': color }}
            >
              <span className="persona-delta-card__label">{label}</span>
              <span
                className={`persona-delta-card__delta persona-delta-card__delta--${deltaMod(delta)}`}
              >
                {formatDelta(delta)}
              </span>
              <span className="persona-delta-card__outcome">
                {deltaOutcome(delta, label)}
              </span>
              {score != null ? (
                <span className="persona-delta-card__score">{score}% current</span>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
