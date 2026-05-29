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

export default function DigitalEnvironment({ environment, storage }) {
  const hasBattery =
    storage &&
    (storage.battery_percent != null ||
      storage.battery_cycles != null ||
      storage.battery_health_percent != null);

  return (
    <div
      className={`po-env-full${hasBattery ? ' po-env-full--3' : storage ? ' po-env-full--2' : ' po-env-full--1'}`}
    >
      <div className="po-panel po-env-panel">
        <span className="po-block-label">Machine</span>
        <div className="po-kv-grid po-kv-grid--flush">
          <KeyValue label="Computer" value={environment?.machineName} />
          <KeyValue label="Model" value={environment?.machineModel} />
          <KeyValue label="Chip" value={environment?.hardwareChip} />
          <KeyValue label="Memory" value={environment?.ram} />
          <KeyValue label="macOS" value={environment?.osVersion} />
          <KeyValue label="Appearance" value={environment?.appearance} />
          <KeyValue label="Display" value={environment?.screenResolution} />
        </div>
      </div>

      {storage ? (
        <div className="po-panel po-env-panel">
          <span className="po-block-label">Storage</span>
          <UsageBar
            label="Disk use"
            percent={storage.usage_percent}
            sublabel={`${storage.usage_percent}% used`}
          />
          <p className="po-secondary po-env-storage-note">
            {storage.used_gb} GB of {storage.total_gb} GB used · {storage.free_gb} GB free
          </p>
        </div>
      ) : null}

      {hasBattery ? (
        <div className="po-panel po-env-panel">
          <span className="po-block-label">Battery</span>
          <UsageBar
            label="Charge"
            percent={storage.battery_percent ?? 0}
            sublabel={`${storage.battery_percent ?? '—'}%`}
          />
          <div className="po-kv-grid po-kv-grid--flush po-kv-grid--compact">
            <KeyValue
              label="Health"
              value={storage.battery_health_percent != null ? `${storage.battery_health_percent}%` : '—'}
            />
            <KeyValue label="Cycles" value={storage.battery_cycles ?? '—'} />
            <KeyValue label="Condition" value={storage.battery_condition ?? '—'} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
