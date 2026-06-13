import { useEffect, useMemo, useState } from 'react';
import { personaPercentToRingFill } from '@/lib/profileUtils.js';
import { PERSONA_UI_COLORS, PERSONA_UI_LABELS } from '@/lib/personaColors.js';

const PERSONA_KEYS = ['productivity', 'security', 'popularity'];
const RING_R = 32;
const RING_CIRC = 2 * Math.PI * RING_R;

function axisKeyToScoreKey(axisKey) {
  const k = String(axisKey || '').toLowerCase();
  if (k === 'popularity' || k === 'popularite' || k === 'social') return 'social';
  if (k === 'productivite') return 'productivity';
  if (k === 'securite') return 'security';
  return k;
}

function normalizeDominant(key) {
  const k = String(key ?? '').toLowerCase();
  if (k === 'social' || k === 'popularite') return 'popularity';
  if (k === 'productivite') return 'productivity';
  if (k === 'securite') return 'security';
  return PERSONA_KEYS.includes(k) ? k : 'productivity';
}

export function formatRingDelta(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n)) return null;
  if (n > 0) return { text: `+${n}`, mod: 'up' };
  if (n < 0) return { text: String(n), mod: 'down' };
  return { text: '=', mod: 'flat' };
}

export default function DashboardPersonaRings({
  scores,
  dominantPersona = 'productivity',
  deltas = null,
  onRingClick,
  wigglePersonaKey = null,
  wiggleNonce = 0,
  className = '',
}) {
  const dom = normalizeDominant(dominantPersona);
  const [wiggleKey, setWiggleKey] = useState(null);

  useEffect(() => {
    if (!wigglePersonaKey || !wiggleNonce) return undefined;
    setWiggleKey(wigglePersonaKey);
    const timer = setTimeout(() => setWiggleKey(null), 480);
    return () => clearTimeout(timer);
  }, [wigglePersonaKey, wiggleNonce]);

  const order = useMemo(() => {
    const others = PERSONA_KEYS.filter((k) => k !== dom);
    if (others.length !== 2) return [...PERSONA_KEYS];
    return [others[0], dom, others[1]];
  }, [dom]);

  return (
    <div className={`dashboard-rings${className ? ` ${className}` : ''}`}>
      {order.map((k) => {
        const ringColor = PERSONA_UI_COLORS[k];
        const scoreKey = axisKeyToScoreKey(k);
        const value = Math.max(0, Math.min(100, Number(scores?.[scoreKey]) || 0));
        const ringFill = personaPercentToRingFill(value);
        const dash = RING_CIRC * (ringFill / 100);
        const gap = RING_CIRC - dash;
        const isDominantRing = k === dom;
        const ringDelta = formatRingDelta(deltas?.[scoreKey]);
        const label = (PERSONA_UI_LABELS[k] ?? k).toLowerCase();

        const sharedProps = {
          'data-persona-ring': k,
          className: `dashboard-ring-card${isDominantRing ? ' dashboard-ring-card--dominant' : ''}${
            wiggleKey === k ? ' dashboard-ring-card--wiggle' : ''
          }`,
          style: { '--ring-accent': ringColor },
          'aria-label': `${PERSONA_UI_LABELS[k] ?? k} ${value}%`,
        };

        const inner = (
          <>
            <svg className="dashboard-ring-svg" viewBox="0 0 80 80" aria-hidden>
              <circle
                cx="40"
                cy="40"
                r={RING_R}
                fill="none"
                stroke="rgba(0, 0, 0, 0.18)"
                strokeWidth="8"
              />
              <circle
                cx="40"
                cy="40"
                r={RING_R}
                fill="none"
                stroke={ringColor}
                strokeWidth="8"
                strokeDasharray={`${dash} ${gap}`}
                strokeLinecap="round"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }}
              />
            </svg>
            <span className="dashboard-ring-label">{label}</span>
            <span className="dashboard-ring-score">
              <span data-persona-ring-score={k}>{Number.isFinite(value) ? value : '—'}</span>
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
          </>
        );

        if (onRingClick) {
          return (
            <button key={k} type="button" {...sharedProps} onClick={onRingClick}>
              {inner}
            </button>
          );
        }

        return (
          <div key={k} {...sharedProps} role="group">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
