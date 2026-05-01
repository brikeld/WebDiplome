function CheckRow({ label, status }) {
  return (
    <div className="po-check-row">
      <span className="po-check-circle">✓</span>
      <span className="po-check-label">{label}</span>
      <span className="po-secondary">{status}</span>
    </div>
  );
}

export default function SecurityStatus({ security }) {
  return (
    <div className="po-card po-security">
      <p className="po-card-title">Security Status</p>

      <CheckRow label="SIP" status={security.sip.status} />
      <CheckRow label="FileVault" status={security.filevault.status} />
      <CheckRow label="Gatekeeper" status={security.gatekeeper.status} />

      <hr className="po-divider" />

      <div className="po-row-between">
        <p className="po-secondary" style={{ margin: 0 }}>Pending update</p>
        <span className="po-pill po-pill--warn">⚠ {security.pending_updates}</span>
      </div>

      <hr className="po-divider" />

      <div className="po-row" style={{ gap: 20 }}>
        <div>
          <p className="po-secondary">Crashes (7d)</p>
          <p style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 0', color: security.crash_reports_7days === 0 ? '#0FA020' : '#FF3366' }}>
            {security.crash_reports_7days}
          </p>
        </div>
        <div>
          <p className="po-secondary">Disk SMART</p>
          <p style={{ fontSize: 13, fontWeight: 700, margin: '2px 0 0' }}>
            {security.disk_smart_status}
          </p>
        </div>
      </div>
    </div>
  );
}
