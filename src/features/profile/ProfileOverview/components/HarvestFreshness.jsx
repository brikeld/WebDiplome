import KeyValue from './KeyValue.jsx';

function formatStamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HarvestFreshness({ harvest }) {
  const rows = [
    ['Last harvest', harvest?.collectedAgo],
    ['Last analysis', harvest?.analysisAgo],
    ['Harvested at', formatStamp(harvest?.collectedAt)],
    ['Analyzed at', formatStamp(harvest?.lastAnalysisAt)],
  ].filter(([, value]) => value != null && value !== '—');

  return (
    <>
      <div className="po-panel">
        <div className="po-kv-grid po-kv-grid--flush">
          {rows.map(([label, value]) => (
            <KeyValue key={label} label={label} value={value} />
          ))}
        </div>
      </div>

      {harvest?.uptimeDays != null || harvest?.applications != null ? (
        <p className="po-summary-line">
          {harvest?.uptimeDays != null ? (
            <>
              Uptime <strong>{harvest.uptimeDays}</strong> day(s)
            </>
          ) : null}
          {harvest?.uptimeDays != null && harvest?.applications != null ? ' · ' : null}
          {harvest?.applications != null ? (
            <>
              <strong>{harvest.applications}</strong> apps indexed
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
