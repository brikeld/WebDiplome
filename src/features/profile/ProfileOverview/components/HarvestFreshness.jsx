import { PoFold } from './PoCard.jsx';
import KeyValue from './KeyValue.jsx';
import PersonaPill from './PersonaPill.jsx';

function formatStamp(iso) {
  if (!iso) return '—';
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

export default function HarvestFreshness({ harvest, expanded = false }) {
  return (
    <>
      <div className="po-panel">
        <div className="po-kv-grid po-kv-grid--compact">
          <KeyValue label="Last harvest" value={harvest.collectedAgo} />
          <KeyValue label="Last analysis" value={harvest.analysisAgo} />
        </div>
      </div>

      <p className="po-summary-line">
        Uptime <strong>{harvest.uptimeDays}</strong> day(s)
        {harvest.applications != null ? (
          <>
            {' '}
            · <strong>{harvest.applications}</strong> apps indexed
          </>
        ) : null}
      </p>

      <PoFold open={expanded}>
        <div className="po-kv-grid">
          <KeyValue label="Harvested at" value={formatStamp(harvest.collectedAt)} />
          <KeyValue label="Analyzed at" value={formatStamp(harvest.lastAnalysisAt)} />
        </div>
        <div className="po-chip-row">
          <PersonaPill dot personaKey="productivity">Machine online</PersonaPill>
        </div>
      </PoFold>
    </>
  );
}
