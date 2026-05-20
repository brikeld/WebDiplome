const PERSONA_DELTA_LINES = [
  { key: 'productivity', label: 'productivity', color: '#D8D8D8' },
  { key: 'social', label: 'social', color: '#CCF847' },
  { key: 'security', label: 'security', color: '#759AEF' },
];

function DeltaValue({ delta, color }) {
  const n = Number(delta);
  if (!Number.isFinite(n) || n === 0) return null;
  const text = n > 0 ? `+${n}` : String(n);
  return (
    <span className="persona-delta-summary__value" style={{ color }}>
      {text}
    </span>
  );
}

function lineCopy(label, delta, color) {
  const n = Number(delta);
  if (!Number.isFinite(n)) {
    return (
      <>
        your {label} persona has <span className="persona-delta-summary__muted">no data</span>
      </>
    );
  }
  if (n > 0) {
    return (
      <>
        your {label} persona has improved by{' '}
        <DeltaValue delta={n} color={color} />
      </>
    );
  }
  if (n < 0) {
    return (
      <>
        your {label} persona has declined by{' '}
        <span className="persona-delta-summary__value" style={{ color }}>
          {Math.abs(n)}
        </span>
      </>
    );
  }
  return <>your {label} persona has not changed</>;
}

export default function PersonaDeltaSummary({ deltas }) {
  if (!deltas) return null;

  return (
    <div className="persona-delta-summary" role="status" aria-live="polite">
      <ul className="persona-delta-summary__list">
        {PERSONA_DELTA_LINES.map(({ key, label, color }) => (
          <li key={key} className="persona-delta-summary__line">
            <span className="persona-delta-summary__text">
              {lineCopy(label, deltas[key], color)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
