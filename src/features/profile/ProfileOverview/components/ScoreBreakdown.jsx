import { personaPercentToRingFill } from '@/lib/profileUtils.js';
import { PERSONA_UI_COLORS } from '@/lib/personaColors.js';
import { formatRingDelta } from '@/features/home/DashboardPersonaRings.jsx';

const RING_RADIUS = 35;
const RING_CX = 40;
const RING_CY = 40;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const STACK_RING_R = 32;
const STACK_RING_CIRC = 2 * Math.PI * STACK_RING_R;

const PERSONA_RINGS = [
  {
    key: 'productivity',
    label: 'Productivity',
    description: 'Code output, file activity and focused active hours.',
  },
  {
    key: 'security',
    label: 'Security',
    description: 'System protection: SIP, FileVault, Gatekeeper and update hygiene.',
  },
  {
    key: 'social',
    label: 'Social',
    description: 'Communication apps, network exposure and public activity.',
  },
];

function Arc({ value, color, size = 80 }) {
  const ringFill = personaPercentToRingFill(value);
  const offset = CIRCUMFERENCE * (1 - ringFill / 100);
  return (
    <svg className="po-ring-svg" viewBox="0 0 80 80" width={size} height={size} aria-hidden>
      <circle cx={RING_CX} cy={RING_CY} r={RING_RADIUS} fill="none" stroke="#e9e7e4" strokeWidth="8" />
      <circle
        cx={RING_CX}
        cy={RING_CY}
        r={RING_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${RING_CX}px ${RING_CY}px` }}
      />
      <text
        x={RING_CX}
        y={RING_CY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="22"
        fontWeight="800"
        fill="#000"
        fontFamily="var(--font-sans)"
      >
        {value}
      </text>
    </svg>
  );
}

function StackRing({ value, color, label, delta }) {
  const ringFill = personaPercentToRingFill(value);
  const dash = STACK_RING_CIRC * (ringFill / 100);
  const gap = STACK_RING_CIRC - dash;
  const ringDelta = formatRingDelta(delta);

  return (
    <div
      className="po-persona-stack-ring dashboard-ring-card dashboard-ring-card--stack"
      style={{ '--ring-accent': color }}
      aria-label={`${label} ${value}%`}
      role="group"
    >
      <svg className="dashboard-ring-svg" viewBox="0 0 80 80" aria-hidden>
        <circle cx="40" cy="40" r={STACK_RING_R} fill="none" stroke="rgba(0, 0, 0, 0.18)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={STACK_RING_R}
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }}
        />
      </svg>
      <span className="dashboard-ring-score">
        <span>{Number.isFinite(value) ? value : '—'}</span>
        {Number.isFinite(value) ? (
          <span className="dashboard-ring-score-pct" aria-hidden>
            %
          </span>
        ) : null}
        {ringDelta ? (
          <span className={`dashboard-ring-delta dashboard-ring-delta--${ringDelta.mod}`}>
            {ringDelta.text}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function labelFor(key) {
  const k = String(key).toLowerCase();
  if (k === 'popularity' || k === 'social') return 'Social';
  if (k === 'productivity') return 'Productivity';
  if (k === 'security') return 'Security';
  return key;
}

function normalizeDominant(key) {
  const k = String(key ?? '').toLowerCase();
  if (k === 'social' || k === 'popularite' || k === 'popularity') return 'social';
  if (k === 'productivite') return 'productivity';
  if (k === 'securite') return 'security';
  return k;
}

export default function ScoreBreakdown({
  scores,
  dominantPersona,
  deltas = null,
  personaBlurbs = null,
  personaBlurbsLoading = false,
  variant = 'card',
}) {
  if (variant === 'stack') {
    const domKey = normalizeDominant(dominantPersona);

    return (
      <div className="po-persona-stack">
        {PERSONA_RINGS.map(({ key, label, description }) => {
          const value = Math.max(0, Math.min(100, Number(scores?.[key]) || 0));
          const isDominant = key === domKey;
          const blurb = personaBlurbs?.[key];
          const copy = blurb || (personaBlurbsLoading ? 'Generating from your harvest…' : description);

          return (
            <div
              key={key}
              className={`po-persona-stack-row${isDominant ? ' po-persona-stack-row--dominant' : ''}`}
            >
              <StackRing
                value={value}
                color={PERSONA_UI_COLORS[key]}
                label={label}
                delta={deltas?.[key]}
              />
              <div className="po-persona-stack-text">
                <span className="po-score-row-label">
                  {label}
                  <i className="po-score-dot" style={{ background: PERSONA_UI_COLORS[key] }} />
                </span>
                <p className={`po-secondary${personaBlurbsLoading && !blurb ? ' po-secondary--pending' : ''}`}>
                  {copy}
                </p>
              </div>
            </div>
          );
        })}
        {dominantPersona ? (
          <p className="po-secondary po-scores-dominant">
            Dominant persona — <strong>{labelFor(dominantPersona)}</strong>. This is the lens the rest
            of the system uses to theme and rank your activity.
          </p>
        ) : null}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="po-scores-detail">
        {PERSONA_RINGS.map(({ key, label, description }) => (
          <div key={key} className="po-score-row">
            <Arc value={scores[key] ?? 0} color={PERSONA_UI_COLORS[key]} size={72} />
            <div className="po-score-row-text">
              <span className="po-score-row-label" style={{ color: '#000' }}>
                {label}
                <i className="po-score-dot" style={{ background: PERSONA_UI_COLORS[key] }} />
              </span>
              <span className="po-secondary">{description}</span>
            </div>
            <span className="po-score-row-value">{scores[key] ?? 0}</span>
          </div>
        ))}
        {dominantPersona ? (
          <p className="po-secondary po-scores-dominant">
            Dominant persona — <strong>{labelFor(dominantPersona)}</strong>. This is the lens the rest
            of the system uses to theme and rank your activity.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="po-panel po-ring-row">
        {PERSONA_RINGS.map(({ key, label }) => (
          <div key={key} className="po-ring-item">
            <Arc value={scores[key] ?? 0} color={PERSONA_UI_COLORS[key]} />
            <span className="po-ring-label">{label}</span>
          </div>
        ))}
      </div>
      {dominantPersona ? (
        <p className="po-secondary po-scores-dominant">
          Dominant persona: <strong>{labelFor(dominantPersona)}</strong>
        </p>
      ) : null}
    </>
  );
}
