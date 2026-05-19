/**
 * Harvest progress inside the dashboard generate card.
 */
export default function HarvestScreen({ progress, error }) {
  const lines = Array.isArray(progress?.lines) ? progress.lines : [];
  const pct = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
  const step = Number(progress?.step) || 0;
  const statusText = progress?.statusText || 'Initializing system scan…';
  const recentLines = lines.slice(-6);

  return (
    <div className="harvest-panel" role="status" aria-live="polite" aria-busy={!error}>
      <p className="harvest-panel__title">Harvesting data</p>
      <p className="harvest-panel__status">{error || statusText}</p>
      {!error ? (
        <>
          <div className="harvest-panel__meta">
            <span>{step > 0 ? `Step ${step}/4` : 'Step 0/4'}</span>
            <span>{pct}%</span>
          </div>
          <div className="harvest-panel__track" aria-hidden>
            <div className="harvest-panel__fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="harvest-panel__log" aria-label="Harvest log">
            {recentLines.length === 0 ? (
              <div className="harvest-panel__log-line harvest-panel__log-line--muted">
                Waiting for desktop collector…
              </div>
            ) : (
              recentLines.map((line, i) => (
                <div
                  key={`${i}-${line.slice(0, 24)}`}
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
        </>
      ) : null}
    </div>
  );
}
