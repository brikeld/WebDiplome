/**
 * Step-row primitives for the inference-chain panel.
 *
 * Each row renders a small LABEL chip + the value text. INFER has its own row
 * variant because it carries extra signal (bias note) that the generic row doesn't.
 *
 * Pulse: when `pulse` changes to a truthy value (we pass `Date.now()`),
 * the row gets a transient `.is-pulsing` modifier that drives a keyframe.
 */

import { useEffect, useState } from 'react';

const STEP_LABELS = {
  data: 'DATA',
  classify: 'CLASSIFY',
  infer: 'INFER',
};

function usePulse(pulse) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!pulse) return undefined;
    setActive(false);
    const raf = requestAnimationFrame(() => setActive(true));
    const off = setTimeout(() => setActive(false), 850);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(off);
    };
  }, [pulse]);
  return active;
}

function ConfidenceBadge({ level }) {
  if (!level) return null;
  const text = level === 'med' ? 'med confidence' : `${level} confidence`;
  return (
    <span
      className={`inference-step__confidence inference-step__confidence--${level}`}
      aria-label={text}
    >
      {text}
    </span>
  );
}

function StepConnector() {
  return (
    <div className="inference-step__connector" aria-hidden>
      <span className="inference-step__connector-line" />
      <svg
        className="inference-step__connector-arrow"
        viewBox="0 0 12 12"
        fill="currentColor"
        aria-hidden
      >
        <path d="M6 9L1.5 4h9z" />
      </svg>
    </div>
  );
}

export function StepRow({ step, value, confidence, source, showConnector, pulse }) {
  const pulsing = usePulse(pulse);
  return (
    <li className={`inference-step inference-step--${step}${pulsing ? ' is-pulsing' : ''}`}>
      <header className="inference-step__head">
        <span className="inference-step__label">{STEP_LABELS[step] ?? step.toUpperCase()}</span>
        <ConfidenceBadge level={confidence} />
      </header>
      <p className="inference-step__value">{value}</p>
      {source ? (
        <p className="inference-step__source">
          <span className="inference-step__source-tag">source</span>
          <span>{source}</span>
        </p>
      ) : null}
      {showConnector ? <StepConnector /> : null}
    </li>
  );
}

export function InferStepRow({ value, confidence, isBiased, biasNote, showConnector = false, pulse }) {
  const pulsing = usePulse(pulse);
  return (
    <li className={`inference-step inference-step--infer${pulsing ? ' is-pulsing' : ''}`}>
      <header className="inference-step__head">
        <span className="inference-step__label">{STEP_LABELS.infer}</span>
        <ConfidenceBadge level={confidence ?? 'low'} />
      </header>
      <p className="inference-step__value">{value}</p>
      {isBiased && biasNote ? (
        <div className="inference-step__bias" role="note">
          <div className="inference-step__bias-head">
            <span className="inference-step__bias-title">Note</span>
            <svg
              className="inference-step__bias-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2 1 21h22L12 2zm0 6 7 12H5l7-12zm-1 3v5h2v-5h-2zm0 6v2h2v-2h-2z" />
            </svg>
          </div>
          <p className="inference-step__bias-note">{biasNote}</p>
        </div>
      ) : null}
      {showConnector ? <StepConnector /> : null}
    </li>
  );
}
