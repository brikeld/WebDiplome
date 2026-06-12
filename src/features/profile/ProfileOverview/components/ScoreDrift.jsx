import { PERSONA_UI_COLORS, PERSONA_UI_LABELS } from '@/lib/personaColors.js';

const AXES = [
  { key: 'productivity', label: 'Productivity' },
  { key: 'security', label: 'Security' },
  { key: 'social', label: 'Social' },
];

function formatDelta(n) {
  if (!n) return '0';
  return n > 0 ? `+${n}` : String(n);
}

function DriftBar({ label, baseline, live, delta, color }) {
  const max = Math.max(baseline, live, 1);
  return (
    <div className="po-drift-row">
      <div className="po-drift-head">
        <span className="po-drift-label">{label}</span>
        <span className="po-drift-values">
          {baseline}% → <strong>{live}%</strong>
          {delta !== 0 ? (
            <span className={`po-drift-delta${delta > 0 ? ' po-drift-delta--up' : ' po-drift-delta--down'}`}>
              {formatDelta(delta)}
            </span>
          ) : null}
        </span>
      </div>
      <div className="po-drift-track">
        <div
          className="po-drift-base"
          style={{ width: `${(baseline / max) * 100}%`, background: color, opacity: 0.35 }}
        />
        <div
          className="po-drift-live"
          style={{ width: `${(live / max) * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function ScoreDrift({ scoreDrift }) {
  const { baseline, live, deltas } = scoreDrift ?? {};
  const hasDrift = AXES.some(({ key }) => deltas?.[key] !== 0);
  const topDelta = AXES.reduce(
    (best, { key }) => (Math.abs(deltas?.[key] ?? 0) > Math.abs(deltas?.[best] ?? 0) ? key : best),
    'productivity',
  );

  return (
    <>
      <div className="po-panel po-drift-panel">
        {AXES.map(({ key, label }) => (
          <DriftBar
            key={key}
            label={label}
            baseline={baseline?.[key] ?? 0}
            live={live?.[key] ?? 0}
            delta={deltas?.[key] ?? 0}
            color={PERSONA_UI_COLORS[key]}
          />
        ))}
      </div>

      <p className="po-summary-line">
        {hasDrift ? (
          <>
            Live scoring moved <strong>{PERSONA_UI_LABELS[topDelta] ?? topDelta}</strong> the most
          </>
        ) : (
          <>Scores match the last harvest baseline</>
        )}
      </p>
      <p className="po-secondary po-foot-note">
        Baseline comes from the last harvest. Hiding posts, comments, and leaderboard visibility
        nudge persona percentages in real time.
      </p>
    </>
  );
}
