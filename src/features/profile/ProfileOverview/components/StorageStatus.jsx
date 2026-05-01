function Bar({ label, percent, fillColor, sublabel }) {
  return (
    <div className="po-bar-wrap">
      <div className="po-bar-label">
        <span>{label}</span>
        <span>{sublabel}</span>
      </div>
      <div className="po-bar-track">
        <div
          className="po-bar-fill"
          style={{ width: `${percent}%`, background: fillColor }}
        />
      </div>
    </div>
  );
}

export default function StorageStatus({ storage }) {
  return (
    <div className="po-card po-storage">
      <p className="po-card-title">Storage &amp; Battery</p>

      <Bar
        label={`Storage — ${storage.used_gb} GB used of ${storage.total_gb} GB`}
        percent={storage.usage_percent}
        fillColor="#FF4E00"
        sublabel={`${storage.usage_percent}% used · ${storage.free_gb} GB free`}
      />

      <Bar
        label={`Battery — ${storage.battery_percent}%`}
        percent={storage.battery_percent}
        fillColor="#0FA020"
        sublabel={storage.battery_condition}
      />

      <div className="po-row" style={{ gap: 16, marginTop: 4 }}>
        <span className="po-secondary">
          Battery health: <strong>{storage.battery_health_percent}%</strong>
        </span>
        <span className="po-pill">{storage.battery_condition}</span>
      </div>
    </div>
  );
}
