# Profile Overview — Design Spec
**Date:** 2026-05-01  
**Feature:** ProfileOverview tab content (Posts | Badges | **Profile** | Rankings)  
**Status:** Approved, ready for implementation

---

## 1. Goal

Fill the currently-empty **Profile** tab with a comprehensive digital surveillance profile snapshot. Content is hardcoded via `mockData.js` initially; the component tree is designed to accept server-provided JSON with zero structural changes.

---

## 2. Integration Point

`ProfileTab.jsx` currently returns `null`. It will import and render `<ProfileOverview />`. No changes to App.jsx, routing, or the TabBar are needed.

```
App.jsx
  └── profile-content-capsule
        └── ProfileTab.jsx  (activeTab === 'profile')
              └── ProfileOverview.jsx  (profileData = mockData fallback)
```

---

## 3. Folder Structure

```
src/features/profile/ProfileOverview/
├── components/
│   ├── IdentityCard.jsx
│   ├── ScoreBreakdown.jsx
│   ├── ActivityPatterns.jsx
│   ├── TechStack.jsx
│   ├── NetworkTrace.jsx
│   ├── StorageStatus.jsx
│   ├── SecurityStatus.jsx
│   ├── LocationInference.jsx
│   └── BehavioralTags.jsx
├── ProfileOverview.jsx
├── profileOverview.css
└── mockData.js
```

---

## 4. Data Flow

### Current (mock)
```jsx
import mockData from './mockData.js';
export default function ProfileOverview({ profileData = mockData }) { ... }
```

### Future (server)
```jsx
// ProfileTab.jsx receives profileData prop from App.jsx and passes it through
<ProfileOverview profileData={serverData} />
```

Each component receives only its slice:
```
IdentityCard       → profileData.profile + profileData.identity
ScoreBreakdown     → profileData.scores
ActivityPatterns   → profileData.activity + profileData.profile.last_activity
TechStack          → profileData.tech_stack
NetworkTrace       → profileData.network
StorageStatus      → profileData.storage
SecurityStatus     → profileData.security
LocationInference  → profileData.identity + profileData.behavioral
BehavioralTags     → profileData.behavioral + profileData.lifestyle
```

---

## 5. Visual Language

### Design system
Matches the existing app exactly — no new color tokens introduced for backgrounds/text:
- Background: `var(--bg)` (#F2F0EF) / card: `var(--card)` (#ffffff)
- Text: `var(--ink)` (#000) / secondary: `var(--muted)` (#888)
- Border: `1px solid var(--border)` (#cccac7)
- Border radius: `var(--capsule-radius)` (56px) on all cards
- Padding: `24px 28px` on all cards
- Font: `var(--font-sans)` (AvantGarde ITC BT)

### Persona accent
Section headers and key values use `var(--persona-accent)` — automatically shifts blue/orange/green with the toggle button.

### Score ring colors (fixed, not persona-dependent)
- Productivity: `#2323FF` (matches `--prod`)
- Security: `#FF4E00` (matches `--sec`)
- Social: `#0FA020` (matches `--pop`)

### Warning/risk color
`#FF3366` for pending updates, risky signals, or anomalies.

---

## 6. Layout

### Zone 1 — Full width (top 3)
```
┌─────────────────────────────────────┐
│  IdentityCard                       │
├─────────────────────────────────────┤
│  ScoreBreakdown                     │
├─────────────────────────────────────┤
│  ActivityPatterns                   │
└─────────────────────────────────────┘
```

### Zone 2 — 2-column grid (bottom 6)
```
┌──────────────────┬──────────────────┐
│  TechStack       │  NetworkTrace    │
├──────────────────┼──────────────────┤
│  StorageStatus   │  SecurityStatus  │
├──────────────────┼──────────────────┤
│  LocationInference│ BehavioralTags  │
└──────────────────┴──────────────────┘
```

Collapses to single column below 768px.

Gap between cards: `16px`. Cards are self-contained (white bg, border, 56px radius).

---

## 7. Component Specs

### IdentityCard
- **Left**: Avatar circle (80px, persona-color 3px border, initials fallback), green status dot bottom-right
- **Right**: Username (large), device name + location (secondary rows), account age computed from `account_created`
- **Bottom**: Badge pills — `Night Owl 🦉`, `Code Warrior ⚔️`, `Creative Professional 🎨`

### ScoreBreakdown
- Central large score (68) inside a thin ring, persona-colored
- Three SVG arc rings in a row below: ~80px diameter, 10px stroke, filled to percentage
  - Productivity (blue), Security (orange), Social (green)
  - Score number centered inside each ring
- Below rings: trend pill (`↑ +5%`) + rank text (`#1847 of 12,450 users`)
- Ring hover shows label + description tooltip

### ActivityPatterns
- 7 vertical bars for days of week, sorted by `days_order` array (Thu tallest)
- Two peak-hour strips: shaded horizontal bar across a 24h timeline at `10 PM–2 AM` + `2 PM–4 PM`
- Status row: sleep pattern badge + uptime + current status string
- Bars use `var(--persona-accent)` for active days, `var(--panel-muted)` for inactive

### TechStack
- App pills grid (2 columns): colored category dot + app name + category label
- Category dot colors: video=#FF4E00, design=#2323FF, development=#0FA020, 3d=#888, browser=#cccac7
- AI tools row with subtle tint background
- Three count badges: "12 Design Tools", "60 Apps Total", "3 AI Assistants"
- Languages as `<code>`-styled tags

### NetworkTrace
- WiFi list: monospace SSID + timestamp-style secondary label
- Caption line: *"Network patterns can infer physical location with high confidence"*
- VPN row: blue shield + "NordVPN active — partial obfuscation"
- Open ports in `<code>` style
- Connectivity status badge top-right

### StorageStatus
- Storage bar: persona-orange fill, label `337.1 GB used of 994.7 GB (33.9%)`
- Battery bar: green fill, label `73% — Normal condition`
- Battery health: `95% health` as secondary row

### SecurityStatus
- Three feature rows: green checkmark circle + label
  - SIP: Enabled, FileVault: On, Gatekeeper: Enabled
- Pending update: yellow `#FFB733` warning pill — "macOS 26.4.1 (security patch pending)"
- Footer: crash count (0) + disk SMART status (Verified)

### LocationInference
- Pin icon + `"Geneva, Switzerland"` as hero text
- School: ECAL (École Cantonale d'Art de Lausanne)
- Language pills: en-CH, de-CH, fr-CH, it-CH
- Context note: *"Regular café and home network patterns detected"*
- Tone: styled as an algorithmic deduction, not a stated fact

### BehavioralTags
- Profile type as large label: `Developer/Designer`
- Inferred role as secondary: `Creative Developer/Designer Student`
- Lifestyle rows: entertainment (Spotify, DAZN, Stremio, Discord), health (TrackWeight, WattsConnected), gaming (Epic Games)
- Personality tag pills with emoji at bottom

---

## 8. Styling Architecture

Single `profileOverview.css` file. No CSS modules, no per-component files.

Key class namespace: `.po-` prefix for all new classes to avoid conflicts with existing styles.

Example classes:
```css
.po-grid           /* Zone 2 two-column grid */
.po-card           /* Base card: white bg, border, radius, padding */
.po-card-title     /* Section header using --persona-accent */
.po-ring-svg       /* ScoreBreakdown SVG container */
.po-bar            /* Storage/battery/activity bars */
.po-pill           /* Badge/tag pills */
.po-badge-row      /* Row of pills */
.po-monospace      /* Monospace data values */
```

---

## 9. Mock Data

`mockData.js` exports the full object specified in the brief. Every component receives only its slice — no component imports mockData directly. ProfileOverview.jsx is the single import point.

---

## 10. Dystopian UX Details

- NetworkTrace: caption framing WiFi as location inference
- LocationInference: phrased as algorithmic certainty ("high confidence")
- ScoreBreakdown: rank shown as `#1847 of 12,450 users` — normalizes surveillance
- ActivityPatterns: "Late-night coding detected" phrasing
- BehavioralTags: "inferred role" language, not "self-reported"
- SecurityStatus: pending update displayed as risk, not routine

---

## 11. Out of Scope

- No data fetching in this iteration (mock data only)
- No edit/interaction beyond hover tooltips on score rings
- No animation beyond CSS transitions on hover
- ProfileTab.jsx change is minimal (import + render, no logic)
