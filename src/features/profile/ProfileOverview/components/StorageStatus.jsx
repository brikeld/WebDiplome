import { PoFold } from './PoCard.jsx';
import PersonaPill from './PersonaPill.jsx';

function Bar({ label, percent, sublabel }) {
  return (
    <div className="po-bar-wrap">
      <div className="po-bar-label">
        <span>{label}</span>
        <span>{sublabel}</span>
      </div>
      <div className="po-bar-track">
        <div className="po-bar-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
}

export default function StorageStatus({ storage, dominantPersona = 'productivity', expanded = false }) {
  return (
    <>
      <div className="po-panel">
        <Bar
          label="Storage"
          percent={storage.usage_percent}
          sublabel={`${storage.usage_percent}% used`}
        />
        <p className="po-secondary po-foot-note" style={{ marginTop: 0 }}>
          {storage.used_gb} GB of {storage.total_gb} GB · {storage.free_gb} GB free
        </p>
      </div>

      <p className="po-summary-line">
        <strong>{storage.usage_percent}%</strong> disk used
        {storage.battery_cycles != null ? (
          <>
            {' '}
            · Battery <strong>{storage.battery_cycles}</strong> cycles
          </>
        ) : null}
      </p>

      <PoFold open={expanded}>
        <div className="po-block">
          <span className="po-block-label">Battery</span>
          <div className="po-panel">
            <Bar
              label="Charge"
              percent={storage.battery_percent ?? 0}
              sublabel={`${storage.battery_percent ?? '—'}%`}
            />
          </div>
        </div>

        <div className="po-chip-row">
          <PersonaPill dot personaKey={dominantPersona}>
            Health {storage.battery_health_percent ?? '—'}%
          </PersonaPill>
          {storage.battery_cycles != null ? (
            <PersonaPill>{storage.battery_cycles} cycles</PersonaPill>
          ) : null}
          {storage.battery_condition && storage.battery_condition !== '—' ? (
            <PersonaPill>{storage.battery_condition}</PersonaPill>
          ) : null}
        </div>
      </PoFold>
    </>
  );
}
