import { useState, useEffect } from 'react';

/** Parse human-readable sizes (e.g. "500 GB", "1.2 TB") to comparable units for %. */
function parseStorageNumber(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const s = String(val).trim();
  const match = s.match(/^([\d.]+)/);
  if (!match) return NaN;
  const n = parseFloat(match[1]);
  const lower = s.toLowerCase();
  if (lower.includes('tb')) return n * 1e12;
  if (lower.includes('gb')) return n * 1e9;
  if (lower.includes('mb')) return n * 1e6;
  if (lower.includes('kb')) return n * 1e3;
  return n;
}

/** Show % when used+total parse; keep raw strings for context. */
function resolveStorageDisplay(p) {
  const u = p.storageUsed ?? p.storage_used;
  const t = p.storageTotal ?? p.storage_total;
  if ((u == null || u === '') && (t == null || t === '')) return '';
  const uStr = u == null || u === '' ? '' : String(u);
  const tStr = t == null || t === '' ? '' : String(t);
  const nu = parseStorageNumber(u);
  const nt = parseStorageNumber(t);
  const pct =
    Number.isFinite(nu) && Number.isFinite(nt) && nt > 0
      ? Math.min(100, Math.round((nu / nt) * 100))
      : null;
  const parts = [];
  if (pct != null) parts.push(`${pct}%`);
  if (uStr && tStr) parts.push(`${uStr} / ${tStr}`);
  else parts.push(uStr || tStr);
  return parts.join(' · ');
}

/** e.g. "3 hours and 47 minutes ago" */
function formatRelativeTimeAgo(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return String(isoOrDate);
  const diff = Math.max(0, Date.now() - d.getTime());
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 45) return 'just now';
  if (min < 60) {
    return min <= 1 ? '1 minute ago' : `${min} minutes ago`;
  }
  if (hr < 24) {
    const m = min % 60;
    const h = hr;
    if (m === 0) return h === 1 ? '1 hour ago' : `${h} hours ago`;
    return `${h} hour${h === 1 ? '' : 's'} and ${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (day < 14) {
    const h = hr % 24;
    if (h === 0) return day === 1 ? '1 day ago' : `${day} days ago`;
    return `${day} day${day === 1 ? '' : 's'} and ${h} hour${h === 1 ? '' : 's'} ago`;
  }
  return `${day} days ago`;
}

/** Keys match POST body from the collector (see api/profile JSON). */
const INFO_FIELDS = [
  {
    label: 'Machine active since',
    keys: ['uptimeDays', 'uptime_days', 'machineActiveSince', 'machine_active_since'],
    format: 'uptimeDays',
  },
  {
    label: 'Last analysis',
    keys: ['lastAnalysisAt', 'last_analysis_at', 'lastAnalysis', 'last_analysis', 'collectedAt', 'collected_at'],
    format: 'relativeTime',
  },
  { label: 'Ram', keys: ['ram'] },
  { label: 'Battery Cycles', keys: ['batteryCycles', 'battery_cycles'] },
  { label: 'Storage used', resolve: resolveStorageDisplay },
  { label: 'Applications', keys: ['applications', 'app_count'] },
  { label: 'System languages', keys: ['systemLanguages', 'system_languages', 'languages'] },
  { label: 'Most Used Apps', keys: ['mostUsedApps', 'most_used_apps', 'top_apps'], format: 'appList' },
  { label: 'Appearance', keys: ['appearance', 'appearence', 'ui_theme'] },
  { label: 'OS Version', keys: ['osVersion', 'os_version'] },
];

function formatValue(val, format) {
  if (val === '' || val == null) return '';
  switch (format) {
    case 'uptimeDays': {
      const n = Number(val);
      if (Number.isFinite(n)) return `${n} day${n === 1 ? '' : 's'}`;
      return String(val);
    }
    case 'relativeTime':
      return formatRelativeTimeAgo(val);
    case 'appList':
      if (!Array.isArray(val)) return String(val);
      return val
        .map((item) =>
          typeof item === 'string' ? item : item?.name ?? item?.app ?? JSON.stringify(item),
        )
        .join(', ');
    default:
      break;
  }
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

function resolveField(obj, field) {
  if (field.resolve) return field.resolve(obj);
  const { keys, format } = field;
  for (const key of keys) {
    if (obj[key] != null && obj[key] !== '') {
      const val = obj[key];
      return format ? formatValue(val, format) : formatValue(val, null);
    }
  }
  return '';
}

export default function ProfileHeader() {
  const [name, setName] = useState('Brikeld Hoxha');
  const [machineName, setMachineName] = useState('il mio MacBook');
  const [globalScore, setGlobalScore] = useState(76);
  const [photoSrc, setPhotoSrc] = useState('');
  const [hardwareChip, setHardwareChip] = useState('M2 Pro');
  const [profile, setProfile] = useState({});
  const [, setTimeTick] = useState(0);

  /** Re-render periodically so "Last analysis" relative text stays fresh. */
  useEffect(() => {
    const id = setInterval(() => setTimeTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchProfile = () => {
      fetch('http://localhost:3001/api/profiles')
        .then((res) => {
          if (!res.ok) throw new Error('failed');
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          if (!Array.isArray(data) || data.length === 0) return;
          const p = data[0];
          if (p.firstname && p.lastname) setName(p.firstname + ' ' + p.lastname);
          if (p.machineName) setMachineName(p.machineName);
          if (p.globalScore != null) setGlobalScore(p.globalScore);
          else if (p.score != null) setGlobalScore(p.score);
          if (p.wallpaperBase64) setPhotoSrc(p.wallpaperBase64);
          const chip = p.hardware_chip ?? p.hardwareChip;
          if (chip && String(chip).trim()) setHardwareChip(String(chip).trim());
          setProfile(p);
        })
        .catch(() => {});
    };

    fetchProfile();
    const id = setInterval(fetchProfile, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="profile-header">
      <div className="profile-card">
        <div className="name">
          {name} <span className="tag">{hardwareChip}</span>
        </div>
        <div className="handle">@{machineName}</div>
        <div className="stats">14 Connections&nbsp;&nbsp; 11 Badges</div>
        <div className="bio">
          AI Generated text that presents what type of profile this is, based on the data.
        </div>
        <div className="badge-row">
          <div className="badge-dot" style={{ background: '#2323FF' }} />
          <div className="badge-dot" style={{ background: '#FF4E00' }} />
          <div className="badge-dot" style={{ background: '#CEFE46' }} />
        </div>
      </div>

      <div className="profile-wallpaper">
        {photoSrc ? (
          <img src={photoSrc} alt="Wallpaper" />
        ) : (
          <span className="wallpaper-placeholder">WALLPAPER</span>
        )}
      </div>

      <div className="machine-info">
        <div className="machine-info-list">
          {INFO_FIELDS.map((field) => (
            <div key={field.label} className="machine-info-row">
              <span className="machine-info-label">{field.label} : </span>
              <span className="machine-info-value">{resolveField(profile, field)}</span>
            </div>
          ))}
        </div>
        <div className="profile-score-tile">{globalScore}</div>
      </div>
    </div>
  );
}
