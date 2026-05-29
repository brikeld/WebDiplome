import PersonaPill from './PersonaPill.jsx';
import KeyValue from './KeyValue.jsx';

const CHECKS = [
  { key: 'sip', label: 'System Integrity Protection', short: 'SIP' },
  { key: 'filevault', label: 'FileVault disk encryption', short: 'FileVault' },
  { key: 'gatekeeper', label: 'Gatekeeper app screening', short: 'Gatekeeper' },
];

function isOn(status) {
  const s = String(status ?? '').toLowerCase();
  return s.includes('enabl') || s.includes('on') || s.includes('active');
}

function CheckRow({ label, status, detailed = false }) {
  const on = isOn(status);
  return (
    <div className="po-check-row">
      <span className={`po-check-circle${on ? ' is-on' : ' is-off'}`} aria-hidden>
        {on ? '✓' : '!'}
      </span>
      <span className="po-check-label">{label}</span>
      <span className={detailed ? 'po-kv-value' : 'po-secondary'}>{status}</span>
    </div>
  );
}

export default function SecurityStatus({ security, variant = 'card' }) {
  if (variant === 'detail') {
    return (
      <div className="po-security-detail">
        {CHECKS.map(({ key, label }) => (
          <CheckRow key={key} label={label} status={security[key]?.status} detailed />
        ))}

        <div className="po-kv-grid" style={{ marginTop: 4 }}>
          <KeyValue label="Pending updates" value={security.pending_updates} />
          <KeyValue label="Crashes (7d)" value={security.crash_reports_7days} />
          <KeyValue label="Disk SMART" value={security.disk_smart_status} />
        </div>
      </div>
    );
  }

  const passing = CHECKS.filter(({ key }) => isOn(security[key]?.status)).length;

  return (
    <>
      {CHECKS.map(({ key, short }) => (
        <CheckRow key={key} label={short} status={security[key]?.status} />
      ))}
      <div className="po-chip-row" style={{ marginTop: 12 }}>
        <PersonaPill dot personaKey="security">
          {passing}/{CHECKS.length} protections on
        </PersonaPill>
      </div>
    </>
  );
}
