import { useEffect, useRef } from 'react';

/**
 * Harvest progress inside the dashboard generate card.
 */
export default function HarvestScreen({ progress, error }) {
  const lines = Array.isArray(progress?.lines) ? progress.lines : [];
  const pct = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
  const step = Number(progress?.step) || 0;
  const statusText = progress?.statusText || 'Initializing system scan…';
  const logRef = useRef(null);
  const activeCells = Math.max(1, Math.ceil((pct / 100) * 27));

  const logKey = lines.join('\n');

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [logKey, statusText]);

  return (
    <div
      className={`harvest-panel${error ? ' harvest-panel--error' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!error}
    >
      <div className="harvest-panel__head">
        <span className="harvest-panel__label">data harvesting</span>
        <span className="harvest-panel__step">
          {step > 0 ? `step ${step}/4` : 'step 0/4'}
        </span>
      </div>
      {!error ? (
        <>
          <div className="harvest-panel__progress-row">
            <div className="harvest-panel__track" aria-hidden>
              <div className="harvest-panel__fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="harvest-panel__percent">{pct}%</span>
          </div>
          <p className="harvest-panel__status">{statusText}</p>
          <div className="harvest-panel__body">
            <div className="harvest-panel__matrix" aria-hidden>
              {Array.from({ length: 27 }).map((_, i) => (
                <span
                  key={i}
                  className={i < activeCells ? 'is-active' : undefined}
                />
              ))}
            </div>
            <div ref={logRef} className="harvest-panel__log" aria-label="Harvest log">
              {lines.length === 0 ? (
                <div className="harvest-panel__log-line harvest-panel__log-line--muted">
                  Waiting for desktop collector
                </div>
              ) : (
                lines.slice(-5).map((line, i) => (
                  <div
                    key={`${i}-${line.slice(0, 32)}`}
                    className={`harvest-panel__log-line${
                      line.includes('✓') || line.includes('[')
                        ? ' harvest-panel__log-line--highlight'
                        : ''
                    }`}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="harvest-panel__status harvest-panel__status--error">{error}</p>
      )}
    </div>
  );
}
