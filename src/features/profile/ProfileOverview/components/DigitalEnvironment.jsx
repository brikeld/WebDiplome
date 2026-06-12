import KeyValue from './KeyValue.jsx';

function UsageBar({ label, percent, sublabel }) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className="po-bar-wrap">
      <div className="po-bar-label">
        <span>{label}</span>
        <span>{sublabel}</span>
      </div>
      <div className="po-bar-track">
        <div className="po-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function kvRows(pairs) {
  return pairs.filter(([, value]) => value != null && value !== '');
}

export default function DigitalEnvironment({ environment, storage, battery, memory }) {
  const env = environment ?? {};
  const machineRows = kvRows([
    ['Computer', env.machineName],
    ['Model', env.machineModel],
    ['Chip', env.hardwareChip],
    ['Memory', env.ram],
    ['macOS', env.osVersion],
    ['Appearance', env.appearance],
    ['Display', env.screenResolution],
    ['Locale', env.locale],
  ]);
  const displays = (env.displays ?? []).filter((d) => d?.name);

  const batteryRows = battery
    ? kvRows([
        ['Health', battery.healthPercent != null ? `${battery.healthPercent}%` : null],
        ['Cycles', battery.cycles],
        ['Condition', battery.condition],
        ['Power', battery.charging != null ? (battery.charging ? 'Charging' : 'On battery') : battery.powerSource],
      ])
    : [];

  const memoryRows = memory
    ? kvRows([
        ['Pressure', memory.pressureLevel],
        ['Swap used', memory.swapUsed],
      ])
    : [];

  return (
    <div className="po-env-grid">
      {machineRows.length > 0 ? (
        <div className="po-panel po-env-panel po-env-panel--machine">
          <span className="po-block-label">Machine</span>
          <div className="po-kv-grid po-kv-grid--flush">
            {machineRows.map(([label, value]) => (
              <KeyValue key={label} label={label} value={value} />
            ))}
          </div>
          {displays.length > 0 ? (
            <div className="po-env-displays">
              {displays.map((d) => (
                <p key={d.name} className="po-secondary po-env-display-row">
                  <strong>{d.name}</strong>
                  {d.resolution ? <> · {d.resolution}</> : null}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {storage ? (
        <div className="po-panel po-env-panel">
          <span className="po-block-label">Storage</span>
          <UsageBar
            label="Disk use"
            percent={storage.usePercent}
            sublabel={storage.usePercent != null ? `${storage.usePercent}% used` : ''}
          />
          <p className="po-secondary po-env-storage-note">
            {storage.usedGb != null && storage.totalGb != null ? (
              <>
                <strong>{storage.usedGb} GB</strong> of {storage.totalGb} GB used
                {storage.freeGb != null ? <> · {storage.freeGb} GB free</> : null}
              </>
            ) : (
              'Capacity unknown'
            )}
          </p>
          {storage.smartStatus ? (
            <div className="po-kv-grid po-kv-grid--flush po-kv-grid--compact">
              <KeyValue label="SMART status" value={storage.smartStatus} />
            </div>
          ) : null}
        </div>
      ) : null}

      {battery ? (
        <div className="po-panel po-env-panel">
          <span className="po-block-label">Battery</span>
          <UsageBar
            label="Charge"
            percent={battery.percent ?? 0}
            sublabel={battery.percent != null ? `${battery.percent}%` : ''}
          />
          {batteryRows.length > 0 ? (
            <div className="po-kv-grid po-kv-grid--flush po-kv-grid--compact">
              {batteryRows.map(([label, value]) => (
                <KeyValue key={label} label={label} value={value} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {memoryRows.length > 0 ? (
        <div className="po-panel po-env-panel">
          <span className="po-block-label">Memory pressure</span>
          <div className="po-kv-grid po-kv-grid--flush">
            {memoryRows.map(([label, value]) => (
              <KeyValue key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
