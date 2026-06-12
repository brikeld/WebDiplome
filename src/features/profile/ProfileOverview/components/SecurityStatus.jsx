import KeyValue from './KeyValue.jsx';
import PersonaPill from './PersonaPill.jsx';

const CHECKS = [
  { key: 'sip', label: 'System Integrity Protection' },
  { key: 'filevault', label: 'FileVault disk encryption' },
  { key: 'gatekeeper', label: 'Gatekeeper app screening' },
];

function isOn(status) {
  const s = String(status ?? '').toLowerCase();
  return s.includes('enabl') || s.includes('on') || s.includes('active');
}

export default function SecurityStatus({ security }) {
  const checks = CHECKS.filter(({ key }) => security?.[key] != null);
  const passing = checks.filter(({ key }) => isOn(security[key])).length;
  const healthRows = [
    ['Crashes (7d)', security?.crashCount7d],
    ['Errors (24h)', security?.errorCount24h],
    ['Disk SMART', security?.smartStatus],
  ].filter(([, value]) => value != null);

  return (
    <div className="po-security-detail">
      {checks.map(({ key, label }) => {
        const on = isOn(security[key]);
        return (
          <div key={key} className="po-check-row">
            <span className={`po-check-circle${on ? ' is-on' : ' is-off'}`} aria-hidden>
              {on ? '✓' : '!'}
            </span>
            <span className="po-check-label">{label}</span>
            <span className="po-check-status">{security[key]}</span>
          </div>
        );
      })}

      {checks.length > 0 ? (
        <div className="po-chip-row">
          <PersonaPill dot personaKey="security">
            {passing}/{checks.length} protections on
          </PersonaPill>
        </div>
      ) : null}

      {healthRows.length > 0 ? (
        <div className="po-kv-grid po-kv-grid--compact">
          {healthRows.map(([label, value]) => (
            <KeyValue key={label} label={label} value={value} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
