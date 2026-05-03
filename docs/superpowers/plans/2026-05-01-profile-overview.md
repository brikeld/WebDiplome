# Profile Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the empty "Profile" tab with a 10-component surveillance-style profile snapshot using hardcoded mock data, light design system, and a `.po-` CSS namespace.

**Architecture:** `ProfileTab.jsx` imports `ProfileOverview.jsx`, which pulls all data from `mockData.js` and fans it out to 9 presentational child components. A single `profileOverview.css` file handles all styles. No data fetching, no global state changes.

**Tech Stack:** React 18, Vite, vanilla CSS with existing design tokens (`--persona-accent`, `--capsule-radius`, `--font-sans`, `--border`, etc.), inline SVG for score arc rings.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/features/profile/ProfileOverview/mockData.js` | Hardcoded full data object |
| Create | `src/features/profile/ProfileOverview/profileOverview.css` | All `.po-*` styles |
| Create | `src/features/profile/ProfileOverview/ProfileOverview.jsx` | Orchestrator, data fan-out |
| Create | `src/features/profile/ProfileOverview/components/IdentityCard.jsx` | Avatar, name, device, badges |
| Create | `src/features/profile/ProfileOverview/components/ScoreBreakdown.jsx` | SVG arc rings, rank |
| Create | `src/features/profile/ProfileOverview/components/ActivityPatterns.jsx` | Day bars, peak hours |
| Create | `src/features/profile/ProfileOverview/components/TechStack.jsx` | Apps, AI tools, languages |
| Create | `src/features/profile/ProfileOverview/components/NetworkTrace.jsx` | WiFi list, VPN, ports |
| Create | `src/features/profile/ProfileOverview/components/StorageStatus.jsx` | Storage + battery bars |
| Create | `src/features/profile/ProfileOverview/components/SecurityStatus.jsx` | SIP/FileVault/Gatekeeper |
| Create | `src/features/profile/ProfileOverview/components/LocationInference.jsx` | Inferred location |
| Create | `src/features/profile/ProfileOverview/components/BehavioralTags.jsx` | Profile type, lifestyle |
| Modify | `src/features/profile/ProfileTab.jsx` | Import + render ProfileOverview |
| Modify | `src/styles.css` | Import profileOverview.css |

---

## Task 1: Mock data + CSS skeleton + ProfileOverview orchestrator

**Files:**
- Create: `src/features/profile/ProfileOverview/mockData.js`
- Create: `src/features/profile/ProfileOverview/profileOverview.css`
- Create: `src/features/profile/ProfileOverview/ProfileOverview.jsx`
- Modify: `src/features/profile/ProfileTab.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Create mockData.js**

```js
// src/features/profile/ProfileOverview/mockData.js
// Replace this import with server-provided data when the API is ready.
const mockData = {
  profile: {
    user_id: 'brikeld_001',
    username: 'Brikeld Hoxha',
    profile_picture: 'profile.jpg',
    status: 'online',
    last_activity: '3d & 8 hours ago',
    account_created: '2024-06-15',
    device_name: "Brikeld's MacBook Pro",
  },
  scores: {
    overall: 68,
    productivity: 72,
    security: 85,
    social: 45,
    trend: '+5%',
    rank_position: 1847,
    rank_total: 12450,
  },
  identity: {
    device: {
      model: 'MacBook Pro',
      macos_version: '26.0',
      hostname: "Brikeld's MacBook Pro",
    },
    location_inferred: 'Geneva, Switzerland',
    languages: ['en-CH', 'de-CH', 'fr-CH', 'it-CH'],
    ui_theme: 'Dark Mode',
    screen_resolution: '3024 x 1964 Retina',
  },
  activity: {
    peak_hours: {
      primary: '10 PM - 2 AM',
      secondary: '2 PM - 4 PM',
    },
    most_active_day: 'Thursday',
    days_order: ['Thursday', 'Tuesday', 'Wednesday', 'Friday', 'Monday', 'Saturday', 'Sunday'],
    sleep_pattern: 'Night Owl (Late-night coding detected)',
    uptime: '1 day',
    current_status: 'Active (machine awake for 46 mins)',
  },
  tech_stack: {
    primary_apps: [
      { name: 'Adobe Premiere Pro 2025', category: 'video' },
      { name: 'Adobe Photoshop 2025', category: 'design' },
      { name: 'Visual Studio Code', category: 'development' },
      { name: 'Blender 4.5.3 LTS', category: '3d' },
      { name: 'Figma', category: 'design' },
      { name: 'Google Chrome', category: 'browser' },
    ],
    ai_tools: ['Claude', 'ChatGPT', 'Cursor'],
    design_tools_count: 12,
    total_apps_installed: 60,
    languages_detected: ['JavaScript/JSX', 'Python', 'HTML/CSS'],
    vcs: 'GitHub Desktop',
  },
  network: {
    wifi_networks_recent: [
      'ECALNET',
      'FibreBox_X6-002887',
      'TP-Link_D58C',
      'eduroam',
      'Ginevra Cafe',
      'Vodafone-C49410867',
    ],
    vpn_detected: 'NordVPN',
    open_ports: ['*.3001', '*.8021', '127.0.0.1.5173'],
    connectivity_status: 'Active',
  },
  content: {
    creator_files_sample: ['App.jsx', 'ProfileHeader.jsx', 'harvesters_enhanced.py', 'PERSONA_SCORING_SPEC.md'],
    consumer_files_sample: ['profile.jpg', 'Dreams.jpg', 'E_sempre_bello.jpg', 'what i want.png'],
    files_modified_7days: 80,
    creator_consumer_ratio: '35% creator / 65% consumer',
  },
  storage: {
    total_gb: 994.7,
    used_gb: 337.1,
    free_gb: 657.6,
    usage_percent: 33.9,
    battery_percent: 73,
    battery_condition: 'Normal',
    battery_health_percent: 95,
  },
  security: {
    sip: { status: 'Enabled', icon: '✓' },
    filevault: { status: 'On', icon: '✓' },
    gatekeeper: { status: 'Enabled', icon: '✓' },
    pending_updates: 'macOS 26.4.1 (security)',
    crash_reports_7days: 0,
    disk_smart_status: 'Verified',
  },
  behavioral: {
    profile_type: 'Developer/Designer',
    badges: ['Night Owl 🦉', 'Code Warrior ⚔️', 'Creative Professional 🎨'],
    inferred_role: 'Creative Developer/Designer Student',
    school_detected: 'ECAL (École Cantonale d\'Art de Lausanne)',
    work_context: 'Freelance/Student Projects',
  },
  lifestyle: {
    entertainment_apps: ['Spotify', 'DAZN', 'Stremio', 'Discord'],
    health_tracking: ['TrackWeight', 'WattsConnected'],
    gaming: ['Epic Games Launcher'],
    last_music_activity: '2026-04-27 10:48',
  },
};

export default mockData;
```

- [ ] **Step 2: Create profileOverview.css skeleton**

```css
/* src/features/profile/ProfileOverview/profileOverview.css */

/* ── Layout ── */
.po-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.po-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .po-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Base card ── */
.po-card {
  box-sizing: border-box;
  background: var(--card, #fff);
  border: 1px solid var(--border, #cccac7);
  border-radius: var(--capsule-radius, 56px);
  padding: 24px 28px;
  font-family: var(--font-sans);
}

.po-card-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--persona-accent, #2323ff);
  margin: 0 0 16px;
}

/* ── Pills / badges ── */
.po-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.po-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px 5px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--panel-muted, #eceae7);
  color: var(--ink, #000);
  white-space: nowrap;
}

.po-pill--accent {
  background: var(--persona-accent, #2323ff);
  color: #fff;
}

.po-pill--warn {
  background: #FFB733;
  color: #000;
}

.po-pill--risk {
  background: #FF3366;
  color: #fff;
}

/* ── Bars ── */
.po-bar-wrap {
  margin-bottom: 16px;
}

.po-bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink, #000);
  margin-bottom: 6px;
}

.po-bar-track {
  width: 100%;
  height: 10px;
  background: var(--panel-muted, #eceae7);
  border-radius: 9999px;
  overflow: hidden;
}

.po-bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

/* ── Monospace data ── */
.po-mono {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  color: var(--ink, #000);
}

/* ── Divider ── */
.po-divider {
  border: none;
  border-top: 1px solid var(--border, #cccac7);
  margin: 16px 0;
}

/* ── Secondary text ── */
.po-secondary {
  font-size: 12px;
  color: var(--muted, #888);
  line-height: 1.4;
}

/* ── Inline row ── */
.po-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.po-row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
```

- [ ] **Step 3: Create ProfileOverview.jsx orchestrator**

```jsx
// src/features/profile/ProfileOverview/ProfileOverview.jsx
import './profileOverview.css';
import mockData from './mockData.js';
import IdentityCard from './components/IdentityCard.jsx';
import ScoreBreakdown from './components/ScoreBreakdown.jsx';
import ActivityPatterns from './components/ActivityPatterns.jsx';
import TechStack from './components/TechStack.jsx';
import NetworkTrace from './components/NetworkTrace.jsx';
import StorageStatus from './components/StorageStatus.jsx';
import SecurityStatus from './components/SecurityStatus.jsx';
import LocationInference from './components/LocationInference.jsx';
import BehavioralTags from './components/BehavioralTags.jsx';

// Replace `profileData = mockData` with server-provided prop when API is ready.
export default function ProfileOverview({ profileData = mockData }) {
  return (
    <div className="po-stack">
      {/* Zone 1 — full width */}
      <IdentityCard
        profile={profileData.profile}
        identity={profileData.identity}
        behavioral={profileData.behavioral}
      />
      <ScoreBreakdown scores={profileData.scores} />
      <ActivityPatterns
        activity={profileData.activity}
        lastActivity={profileData.profile.last_activity}
      />

      {/* Zone 2 — 2-column grid */}
      <div className="po-grid">
        <TechStack techStack={profileData.tech_stack} />
        <NetworkTrace network={profileData.network} />
        <StorageStatus storage={profileData.storage} />
        <SecurityStatus security={profileData.security} />
        <LocationInference
          identity={profileData.identity}
          behavioral={profileData.behavioral}
        />
        <BehavioralTags
          behavioral={profileData.behavioral}
          lifestyle={profileData.lifestyle}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update ProfileTab.jsx**

Replace the entire file:

```jsx
// src/features/profile/ProfileTab.jsx
import ProfileOverview from './ProfileOverview/ProfileOverview.jsx';

export default function ProfileTab() {
  return <ProfileOverview />;
}
```

- [ ] **Step 5: Import profileOverview.css in src/styles.css**

Open `src/styles.css` and add this line (append at the end):

```css
@import './features/profile/ProfileOverview/profileOverview.css';
```

- [ ] **Step 6: Create the components/ directory and verify Vite compiles**

```bash
mkdir -p src/features/profile/ProfileOverview/components
```

Then open `http://localhost:5173`, navigate to Profile view, click the **Profile** tab. Expected: blank white area (no crash — imports resolve, components don't exist yet so you'll see import errors in console — that's expected and fixed by the next tasks).

Actually, create stub files for all 9 components so the app compiles now:

```bash
for name in IdentityCard ScoreBreakdown ActivityPatterns TechStack NetworkTrace StorageStatus SecurityStatus LocationInference BehavioralTags; do
  echo "export default function ${name}() { return null; }" > src/features/profile/ProfileOverview/components/${name}.jsx
done
```

Reload. Expected: Profile tab renders without error (blank, since all components return null).

- [ ] **Step 7: Commit**

```bash
git add src/features/profile/ProfileOverview/ src/features/profile/ProfileTab.jsx src/styles.css
git commit -m "feat: scaffold ProfileOverview with mock data and CSS foundation"
```

---

## Task 2: IdentityCard

**Files:**
- Modify: `src/features/profile/ProfileOverview/components/IdentityCard.jsx`
- Modify: `src/features/profile/ProfileOverview/profileOverview.css` (append)

- [ ] **Step 1: Replace IdentityCard.jsx**

```jsx
// src/features/profile/ProfileOverview/components/IdentityCard.jsx

function accountAge(dateStr) {
  const created = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''}`;
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function IdentityCard({ profile, identity, behavioral }) {
  return (
    <div className="po-card po-identity">
      <p className="po-card-title">Identity</p>

      <div className="po-identity-top">
        {/* Avatar */}
        <div className="po-avatar-wrap">
          <div className="po-avatar">
            <span className="po-avatar-initials">{initials(profile.username)}</span>
          </div>
          <span
            className="po-status-dot"
            style={{ background: profile.status === 'online' ? '#0FA020' : '#888' }}
            title={profile.status}
          />
        </div>

        {/* Info block */}
        <div className="po-identity-info">
          <p className="po-identity-name">{profile.username}</p>
          <p className="po-secondary">
            <span className="po-identity-label">Device</span>{' '}
            {identity.device.hostname}
          </p>
          <p className="po-secondary">
            <span className="po-identity-label">Location</span>{' '}
            {identity.location_inferred}
          </p>
          <p className="po-secondary">
            <span className="po-identity-label">Account age</span>{' '}
            {accountAge(profile.account_created)}
          </p>
          <p className="po-secondary">
            <span className="po-identity-label">Last seen</span>{' '}
            {profile.last_activity}
          </p>
        </div>
      </div>

      <div className="po-badge-row">
        {behavioral.badges.map(b => (
          <span key={b} className="po-pill">{b}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append IdentityCard styles to profileOverview.css**

```css
/* ── IdentityCard ── */
.po-identity-top {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.po-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.po-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid var(--persona-accent, #2323ff);
  background: color-mix(in srgb, var(--persona-accent, #2323ff) 15%, #fff);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.po-avatar-initials {
  font-family: var(--font-sans);
  font-size: 26px;
  font-weight: 800;
  color: var(--persona-accent, #2323ff);
  line-height: 1;
}

.po-status-dot {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
}

.po-identity-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.po-identity-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink, #000);
  margin: 0 0 4px;
  line-height: 1.1;
}

.po-identity-label {
  font-weight: 700;
  color: var(--ink, #000);
}
```

- [ ] **Step 3: Verify in browser**

Open Profile → Profile tab. Expected: card with avatar circle (initials "BH"), username, device, location, account age, last seen, three badge pills.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/ProfileOverview/components/IdentityCard.jsx src/features/profile/ProfileOverview/profileOverview.css
git commit -m "feat: add IdentityCard component"
```

---

## Task 3: ScoreBreakdown

**Files:**
- Modify: `src/features/profile/ProfileOverview/components/ScoreBreakdown.jsx`
- Modify: `src/features/profile/ProfileOverview/profileOverview.css` (append)

- [ ] **Step 1: Replace ScoreBreakdown.jsx**

```jsx
// src/features/profile/ProfileOverview/components/ScoreBreakdown.jsx

const RING_RADIUS = 35;
const RING_CX = 40;
const RING_CY = 40;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function Arc({ value, color, label, description }) {
  const offset = CIRCUMFERENCE * (1 - value / 100);
  return (
    <div className="po-ring-item" title={description}>
      <svg className="po-ring-svg" viewBox="0 0 80 80" width="80" height="80">
        {/* Track */}
        <circle
          cx={RING_CX} cy={RING_CY} r={RING_RADIUS}
          fill="none" stroke="var(--panel-muted, #eceae7)" strokeWidth="8"
        />
        {/* Fill */}
        <circle
          cx={RING_CX} cy={RING_CY} r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${RING_CX}px ${RING_CY}px` }}
        />
        <text
          x={RING_CX} y={RING_CY}
          textAnchor="middle" dominantBaseline="central"
          fontSize="16" fontWeight="800"
          fill={color}
          fontFamily="var(--font-sans)"
        >
          {value}
        </text>
      </svg>
      <span className="po-ring-label" style={{ color }}>{label}</span>
    </div>
  );
}

export default function ScoreBreakdown({ scores }) {
  const trendUp = scores.trend.startsWith('+');
  return (
    <div className="po-card po-scores">
      <p className="po-card-title">Behavioral Score</p>

      {/* Central score */}
      <div className="po-score-center">
        <svg viewBox="0 0 120 120" width="120" height="120" className="po-score-main-svg">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--panel-muted, #eceae7)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke="var(--persona-accent, #2323ff)"
            strokeWidth="10"
            strokeDasharray={2 * Math.PI * 50}
            strokeDashoffset={2 * Math.PI * 50 * (1 - scores.overall / 100)}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
          />
          <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
            fontSize="32" fontWeight="800" fill="var(--ink, #000)"
            fontFamily="var(--font-sans)">
            {scores.overall}
          </text>
        </svg>
        <div className="po-score-meta">
          <span className="po-pill po-pill--accent" style={{ fontSize: 13 }}>
            {trendUp ? '↑' : '↓'} {scores.trend} this week
          </span>
          <p className="po-secondary" style={{ marginTop: 6 }}>
            Rank <strong>#{scores.rank_position.toLocaleString()}</strong> of {scores.rank_total.toLocaleString()} users
          </p>
        </div>
      </div>

      <hr className="po-divider" />

      {/* Three sub-rings */}
      <div className="po-ring-row">
        <Arc value={scores.productivity} color="#2323FF" label="Productivity" description="Code output, file modifications, active hours" />
        <Arc value={scores.security} color="#FF4E00" label="Security" description="SIP, FileVault, Gatekeeper, update compliance" />
        <Arc value={scores.social} color="#0FA020" label="Social" description="Network exposure, communication apps, public activity" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append ScoreBreakdown styles to profileOverview.css**

```css
/* ── ScoreBreakdown ── */
.po-score-center {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.po-score-main-svg {
  flex-shrink: 0;
}

.po-score-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.po-ring-row {
  display: flex;
  justify-content: space-around;
  gap: 16px;
  flex-wrap: wrap;
}

.po-ring-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: default;
  transition: transform 0.15s;
}

.po-ring-item:hover {
  transform: scale(1.06);
}

.po-ring-svg {
  display: block;
}

.po-ring-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
```

- [ ] **Step 3: Verify in browser**

Profile → Profile tab. Expected: central 120px ring with "68", three 80px arc rings (blue 72, orange 85, green 45), trend pill, rank text. Hovering a ring scales it up.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/ProfileOverview/components/ScoreBreakdown.jsx src/features/profile/ProfileOverview/profileOverview.css
git commit -m "feat: add ScoreBreakdown with SVG arc rings"
```

---

## Task 4: ActivityPatterns

**Files:**
- Modify: `src/features/profile/ProfileOverview/components/ActivityPatterns.jsx`
- Modify: `src/features/profile/ProfileOverview/profileOverview.css` (append)

- [ ] **Step 1: Replace ActivityPatterns.jsx**

```jsx
// src/features/profile/ProfileOverview/components/ActivityPatterns.jsx

// Activity level by position in days_order: index 0 = most active (1.0), descending.
function activityLevels(daysOrder) {
  const total = daysOrder.length;
  return daysOrder.map((day, i) => ({
    day: day.slice(0, 3),
    level: parseFloat((1 - (i / (total - 1)) * 0.85).toFixed(2)),
  }));
}

// Convert "10 PM" → fraction of 24h for positioning
function hourToFraction(timeStr) {
  const match = timeStr.match(/(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  if (match[2].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[2].toUpperCase() === 'AM' && h === 12) h = 0;
  return h / 24;
}

function PeakStrip({ label, range }) {
  const [start, end] = range.split(' - ');
  const s = hourToFraction(start.trim());
  let e = hourToFraction(end.trim());
  if (e < s) e = 1; // wrap past midnight
  const left = `${(s * 100).toFixed(1)}%`;
  const width = `${((e - s) * 100).toFixed(1)}%`;
  return (
    <div className="po-peak-row">
      <span className="po-secondary po-peak-label">{label}</span>
      <div className="po-peak-track">
        <div
          className="po-peak-fill"
          style={{ left, width }}
        />
        {/* Hour ticks */}
        {[0,6,12,18,24].map(h => (
          <span key={h} className="po-peak-tick" style={{ left: `${(h/24*100).toFixed(1)}%` }}>
            {h === 0 ? '12a' : h === 12 ? '12p' : h === 24 ? '' : h > 12 ? `${h-12}p` : `${h}a`}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ActivityPatterns({ activity, lastActivity }) {
  const bars = activityLevels(activity.days_order);

  return (
    <div className="po-card po-activity">
      <p className="po-card-title">Activity Patterns</p>

      {/* Day bars */}
      <div className="po-day-bars">
        {bars.map(({ day, level }) => (
          <div key={day} className="po-day-col">
            <div className="po-day-bar-wrap">
              <div
                className="po-day-bar"
                style={{ height: `${level * 100}%` }}
                title={`${Math.round(level * 100)}% activity`}
              />
            </div>
            <span className="po-day-label">{day}</span>
          </div>
        ))}
      </div>

      <hr className="po-divider" />

      {/* Peak hour timelines */}
      <p className="po-secondary" style={{ marginBottom: 10, fontWeight: 700, color: 'var(--ink)' }}>
        Peak hours
      </p>
      <PeakStrip label="Primary" range={activity.peak_hours.primary} />
      <PeakStrip label="Secondary" range={activity.peak_hours.secondary} />

      <hr className="po-divider" />

      {/* Status row */}
      <div className="po-badge-row" style={{ marginTop: 0 }}>
        <span className="po-pill">{activity.sleep_pattern}</span>
        <span className="po-pill">Uptime: {activity.uptime}</span>
        <span className="po-pill po-pill--accent">{activity.current_status}</span>
      </div>
      <p className="po-secondary" style={{ marginTop: 8 }}>
        Last activity: {lastActivity}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Append ActivityPatterns styles to profileOverview.css**

```css
/* ── ActivityPatterns ── */
.po-day-bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 80px;
  margin-bottom: 4px;
}

.po-day-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.po-day-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
}

.po-day-bar {
  width: 100%;
  background: var(--persona-accent, #2323ff);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
  opacity: 0.85;
}

.po-day-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.po-peak-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.po-peak-label {
  flex: 0 0 64px;
  font-weight: 600 !important;
  color: var(--ink) !important;
  font-size: 11px;
}

.po-peak-track {
  flex: 1;
  height: 20px;
  background: var(--panel-muted, #eceae7);
  border-radius: 4px;
  position: relative;
  overflow: visible;
}

.po-peak-fill {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--persona-accent, #2323ff);
  opacity: 0.6;
  border-radius: 4px;
}

.po-peak-tick {
  position: absolute;
  bottom: -16px;
  transform: translateX(-50%);
  font-size: 9px;
  color: var(--muted, #888);
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify in browser**

Profile → Profile tab. Expected: 7 day bars (Thu tallest), two peak-hour strips with shaded regions, badges row with sleep pattern + uptime + status.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/ProfileOverview/components/ActivityPatterns.jsx src/features/profile/ProfileOverview/profileOverview.css
git commit -m "feat: add ActivityPatterns component"
```

---

## Task 5: TechStack

**Files:**
- Modify: `src/features/profile/ProfileOverview/components/TechStack.jsx`
- Modify: `src/features/profile/ProfileOverview/profileOverview.css` (append)

- [ ] **Step 1: Replace TechStack.jsx**

```jsx
// src/features/profile/ProfileOverview/components/TechStack.jsx

const CATEGORY_COLORS = {
  video:       '#FF4E00',
  design:      '#2323FF',
  development: '#0FA020',
  '3d':        '#888888',
  browser:     '#cccac7',
};

export default function TechStack({ techStack }) {
  return (
    <div className="po-card po-tech">
      <p className="po-card-title">Tech Stack</p>

      {/* Primary apps */}
      <div className="po-app-grid">
        {techStack.primary_apps.map(app => (
          <div key={app.name} className="po-app-item">
            <span
              className="po-app-dot"
              style={{ background: CATEGORY_COLORS[app.category] ?? '#888' }}
            />
            <div className="po-app-text">
              <span className="po-app-name">{app.name}</span>
              <span className="po-app-category">{app.category}</span>
            </div>
          </div>
        ))}
      </div>

      <hr className="po-divider" />

      {/* AI tools */}
      <p className="po-secondary" style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        AI Dependency Detected
      </p>
      <div className="po-ai-row">
        {techStack.ai_tools.map(tool => (
          <span key={tool} className="po-pill po-pill--accent">{tool}</span>
        ))}
      </div>

      <hr className="po-divider" />

      {/* Languages */}
      <p className="po-secondary" style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        Languages detected
      </p>
      <div className="po-badge-row" style={{ marginTop: 0 }}>
        {techStack.languages_detected.map(lang => (
          <code key={lang} className="po-code-tag">{lang}</code>
        ))}
      </div>

      <hr className="po-divider" />

      {/* Count badges */}
      <div className="po-badge-row" style={{ marginTop: 0 }}>
        <span className="po-pill">{techStack.design_tools_count} Design Tools</span>
        <span className="po-pill">{techStack.total_apps_installed} Apps Total</span>
        <span className="po-pill">{techStack.ai_tools.length} AI Assistants</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append TechStack styles to profileOverview.css**

```css
/* ── TechStack ── */
.po-app-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.po-app-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.po-app-dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.po-app-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.po-app-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink, #000);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.po-app-category {
  font-size: 10px;
  color: var(--muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.po-ai-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.po-code-tag {
  font-family: 'Courier New', Courier, monospace;
  font-size: 11px;
  padding: 3px 8px;
  background: var(--panel-muted, #eceae7);
  border-radius: 4px;
  color: var(--ink, #000);
}
```

- [ ] **Step 3: Verify in browser**

Expected: 6 app items in 2-col grid with colored dots, AI tools in accent pills, language code tags, count badges.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/ProfileOverview/components/TechStack.jsx src/features/profile/ProfileOverview/profileOverview.css
git commit -m "feat: add TechStack component"
```

---

## Task 6: NetworkTrace

**Files:**
- Modify: `src/features/profile/ProfileOverview/components/NetworkTrace.jsx`
- Modify: `src/features/profile/ProfileOverview/profileOverview.css` (append)

- [ ] **Step 1: Replace NetworkTrace.jsx**

```jsx
// src/features/profile/ProfileOverview/components/NetworkTrace.jsx

export default function NetworkTrace({ network }) {
  return (
    <div className="po-card po-network">
      <div className="po-row-between">
        <p className="po-card-title" style={{ margin: 0 }}>Network Trace</p>
        <span className="po-pill po-pill--accent">{network.connectivity_status}</span>
      </div>

      {/* WiFi networks */}
      <div className="po-network-list">
        {network.wifi_networks_recent.map(ssid => (
          <div key={ssid} className="po-network-item">
            <span className="po-network-icon">⌘</span>
            <span className="po-mono">{ssid}</span>
          </div>
        ))}
      </div>
      <p className="po-secondary po-creepy-note">
        ⚠ Network patterns can infer physical location with high confidence
      </p>

      <hr className="po-divider" />

      {/* VPN */}
      <div className="po-row" style={{ marginBottom: 8 }}>
        <span className="po-network-vpn-dot" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#2323FF' }}>
          {network.vpn_detected} active
        </span>
        <span className="po-secondary" style={{ marginLeft: 4 }}>— partial obfuscation</span>
      </div>

      {/* Open ports */}
      <p className="po-secondary" style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
        Open ports detected
      </p>
      <div className="po-badge-row" style={{ marginTop: 0 }}>
        {network.open_ports.map(port => (
          <code key={port} className="po-code-tag">{port}</code>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append NetworkTrace styles to profileOverview.css**

```css
/* ── NetworkTrace ── */
.po-network-list {
  margin: 12px 0 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.po-network-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.po-network-icon {
  font-size: 12px;
  color: var(--muted, #888);
  flex-shrink: 0;
}

.po-creepy-note {
  font-size: 11px !important;
  color: #FF3366 !important;
  font-style: italic;
  margin-top: 6px;
}

.po-network-vpn-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2323FF;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verify in browser**

Expected: connectivity badge top-right, 6 WiFi SSIDs in monospace, red warning caption, VPN row with blue dot, open ports as code tags.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/ProfileOverview/components/NetworkTrace.jsx src/features/profile/ProfileOverview/profileOverview.css
git commit -m "feat: add NetworkTrace component"
```

---

## Task 7: StorageStatus

**Files:**
- Modify: `src/features/profile/ProfileOverview/components/StorageStatus.jsx`

- [ ] **Step 1: Replace StorageStatus.jsx**

```jsx
// src/features/profile/ProfileOverview/components/StorageStatus.jsx

function Bar({ label, value, max, percent, fillColor, sublabel }) {
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
```

- [ ] **Step 2: Verify in browser**

Expected: two horizontal bars — orange storage (33.9% filled), green battery (73% filled), health text below.

- [ ] **Step 3: Commit**

```bash
git add src/features/profile/ProfileOverview/components/StorageStatus.jsx
git commit -m "feat: add StorageStatus component"
```

---

## Task 8: SecurityStatus

**Files:**
- Modify: `src/features/profile/ProfileOverview/components/SecurityStatus.jsx`
- Modify: `src/features/profile/ProfileOverview/profileOverview.css` (append)

- [ ] **Step 1: Replace SecurityStatus.jsx**

```jsx
// src/features/profile/ProfileOverview/components/SecurityStatus.jsx

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
```

- [ ] **Step 2: Append SecurityStatus styles to profileOverview.css**

```css
/* ── SecurityStatus ── */
.po-check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.po-check-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #0FA020;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.po-check-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink, #000);
  flex: 1;
}
```

- [ ] **Step 3: Verify in browser**

Expected: three green check rows (SIP/FileVault/Gatekeeper), yellow pending update pill, crash count in green "0", disk SMART text.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/ProfileOverview/components/SecurityStatus.jsx src/features/profile/ProfileOverview/profileOverview.css
git commit -m "feat: add SecurityStatus component"
```

---

## Task 9: LocationInference

**Files:**
- Modify: `src/features/profile/ProfileOverview/components/LocationInference.jsx`
- Modify: `src/features/profile/ProfileOverview/profileOverview.css` (append)

- [ ] **Step 1: Replace LocationInference.jsx**

```jsx
// src/features/profile/ProfileOverview/components/LocationInference.jsx

export default function LocationInference({ identity, behavioral }) {
  return (
    <div className="po-card po-location">
      <p className="po-card-title">Location Inference</p>

      <div className="po-location-hero">
        <span className="po-location-pin">📍</span>
        <div>
          <p className="po-location-place">{identity.location_inferred}</p>
          <p className="po-secondary">Inferred with high confidence</p>
        </div>
      </div>

      <hr className="po-divider" />

      <div className="po-location-clue">
        <span className="po-secondary po-clue-label">Institution</span>
        <span className="po-location-value">{behavioral.school_detected}</span>
      </div>

      <div className="po-location-clue">
        <span className="po-secondary po-clue-label">Languages</span>
        <div className="po-badge-row" style={{ marginTop: 4 }}>
          {identity.languages.map(lang => (
            <span key={lang} className="po-pill">{lang}</span>
          ))}
        </div>
      </div>

      <div className="po-location-clue">
        <span className="po-secondary po-clue-label">Network patterns</span>
        <span className="po-secondary po-creepy-note" style={{ display: 'block', marginTop: 4 }}>
          Regular café and home network patterns detected
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append LocationInference styles to profileOverview.css**

```css
/* ── LocationInference ── */
.po-location-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.po-location-pin {
  font-size: 28px;
  flex-shrink: 0;
}

.po-location-place {
  font-size: 20px;
  font-weight: 800;
  color: var(--ink, #000);
  margin: 0;
  line-height: 1.2;
}

.po-location-clue {
  margin-top: 12px;
}

.po-clue-label {
  display: block;
  font-weight: 700 !important;
  color: var(--ink) !important;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.po-location-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink, #000);
}
```

- [ ] **Step 3: Verify in browser**

Expected: pin emoji + "Geneva, Switzerland" hero, "Inferred with high confidence" secondary text, school name, language pills, red creepy network note.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/ProfileOverview/components/LocationInference.jsx src/features/profile/ProfileOverview/profileOverview.css
git commit -m "feat: add LocationInference component"
```

---

## Task 10: BehavioralTags

**Files:**
- Modify: `src/features/profile/ProfileOverview/components/BehavioralTags.jsx`
- Modify: `src/features/profile/ProfileOverview/profileOverview.css` (append)

- [ ] **Step 1: Replace BehavioralTags.jsx**

```jsx
// src/features/profile/ProfileOverview/components/BehavioralTags.jsx

export default function BehavioralTags({ behavioral, lifestyle }) {
  return (
    <div className="po-card po-behavioral">
      <p className="po-card-title">Behavioral Profile</p>

      <p className="po-behavioral-type">{behavioral.profile_type}</p>
      <p className="po-secondary" style={{ marginBottom: 12 }}>
        Inferred role: <strong>{behavioral.inferred_role}</strong>
      </p>
      <p className="po-secondary" style={{ marginBottom: 16 }}>
        Work context: {behavioral.work_context}
      </p>

      <hr className="po-divider" />

      {/* Lifestyle signals */}
      <div className="po-lifestyle-section">
        <span className="po-clue-label">Entertainment</span>
        <div className="po-badge-row" style={{ marginTop: 4 }}>
          {lifestyle.entertainment_apps.map(app => (
            <span key={app} className="po-pill">{app}</span>
          ))}
        </div>
      </div>

      <div className="po-lifestyle-section">
        <span className="po-clue-label">Health tracking</span>
        <div className="po-badge-row" style={{ marginTop: 4 }}>
          {lifestyle.health_tracking.map(app => (
            <span key={app} className="po-pill">{app}</span>
          ))}
        </div>
      </div>

      <div className="po-lifestyle-section">
        <span className="po-clue-label">Gaming</span>
        <div className="po-badge-row" style={{ marginTop: 4 }}>
          {lifestyle.gaming.map(app => (
            <span key={app} className="po-pill">{app}</span>
          ))}
        </div>
      </div>

      <hr className="po-divider" />

      {/* Personality tags */}
      <div className="po-badge-row" style={{ marginTop: 0 }}>
        {behavioral.badges.map(badge => (
          <span key={badge} className="po-pill po-pill--accent">{badge}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append BehavioralTags styles to profileOverview.css**

```css
/* ── BehavioralTags ── */
.po-behavioral-type {
  font-size: 22px;
  font-weight: 800;
  color: var(--ink, #000);
  margin: 0 0 4px;
  line-height: 1.1;
}

.po-lifestyle-section {
  margin-top: 12px;
}
```

- [ ] **Step 3: Verify in browser**

Expected: "Developer/Designer" large header, inferred role + work context, lifestyle pills in three sections (Entertainment/Health/Gaming), personality badge pills in persona accent color at bottom.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/ProfileOverview/components/BehavioralTags.jsx src/features/profile/ProfileOverview/profileOverview.css
git commit -m "feat: add BehavioralTags component"
```

---

## Task 11: Responsive check + final polish

**Files:**
- Modify: `src/features/profile/ProfileOverview/profileOverview.css` (append)

- [ ] **Step 1: Add mobile responsive rules to profileOverview.css**

```css
/* ── Responsive ── */
@media (max-width: 600px) {
  .po-card {
    border-radius: 24px;
    padding: 18px 16px;
  }

  .po-identity-top {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .po-identity-info {
    align-items: center;
  }

  .po-score-center {
    flex-direction: column;
    align-items: center;
  }

  .po-app-grid {
    grid-template-columns: 1fr;
  }

  .po-ring-row {
    gap: 24px;
  }
}
```

- [ ] **Step 2: Verify full layout in browser at multiple widths**

- At ≥ 769px: Zone 1 full-width stack, Zone 2 two-column grid — all 10 cards visible
- At 600–768px: Zone 2 collapses to single column, Zone 1 unchanged
- At < 600px: cards use smaller radius + reduced padding, identity card stacks vertically

- [ ] **Step 3: Final commit**

```bash
git add src/features/profile/ProfileOverview/profileOverview.css
git commit -m "feat: complete ProfileOverview — all 10 components, responsive layout"
```

---

## Self-Review Notes

- All 9 component specs covered (IdentityCard → BehavioralTags)
- ScoreBreakdown uses SVG arc with `rotate(-90deg)` transform to start arcs from 12 o'clock
- All `.po-` class names are consistent across JSX and CSS
- `profileData.profile.last_activity` passed explicitly to ActivityPatterns (it doesn't come from `activity` key)
- `CATEGORY_COLORS` map in TechStack covers all 5 categories from mock data: video, design, development, 3d, browser
- `po-clue-label` reused in both LocationInference and BehavioralTags — defined once in the CSS
- StorageStatus uses no extra CSS (reuses `.po-bar-*` from foundation) — no append step needed
- `src/styles.css` import added in Task 1 Step 5 — CSS available for all subsequent tasks
