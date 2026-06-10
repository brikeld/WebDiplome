import { PERSONA_UI_COLORS, PERSONA_UI_LABELS } from '@/lib/personaColors.js';

function personaLabel(key) {
  const k = String(key ?? '').toLowerCase();
  if (k === 'social' || k === 'popularite') return PERSONA_UI_LABELS.popularity;
  if (k === 'securite') return PERSONA_UI_LABELS.security;
  if (k === 'productivite') return PERSONA_UI_LABELS.productivity;
  return PERSONA_UI_LABELS[k] ?? key;
}

function personaColor(key) {
  const k = String(key ?? '').toLowerCase();
  if (k === 'social' || k === 'popularite') return PERSONA_UI_COLORS.popularity;
  if (k === 'securite') return PERSONA_UI_COLORS.security;
  if (k === 'productivite') return PERSONA_UI_COLORS.productivity;
  return PERSONA_UI_COLORS[k] ?? PERSONA_UI_COLORS.productivity;
}

export default function PersonaChangeCapsule({
  userDisplayName = 'User',
  fromPersona,
  toPersona,
  exiting = false,
  className = '',
}) {
  const fromLabel = personaLabel(fromPersona);
  const toLabel = personaLabel(toPersona);
  const accent = personaColor(toPersona);

  return (
    <div
      className={`dashboard-persona-change${exiting ? ' dashboard-persona-change--exit' : ''}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Main persona changed from ${fromLabel} to ${toLabel}`}
    >
      <div
        className="dashboard-persona-change__capsule"
        style={{ '--persona-accent': accent }}
      >
        <p className="dashboard-persona-change__text">
          <span className="dashboard-persona-change__name">{userDisplayName}</span>
          {', your Compliant main persona has changed from '}
          <span className="dashboard-persona-change__persona" style={{ color: personaColor(fromPersona) }}>
            {fromLabel}
          </span>
          {' to '}
          <span className="dashboard-persona-change__persona" style={{ color: accent }}>
            {toLabel}
          </span>
          .
        </p>
      </div>
    </div>
  );
}
