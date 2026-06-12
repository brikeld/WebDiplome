# Profile Overview Redesign — Design

Date: 2026-06-12
Scope: the "Profile" tab data-visualization view (`src/features/profile/ProfileOverview/`) plus the
server mapping that feeds it.

## Problems observed

1. **Data never reaches the client.** Hosted profiles live in Supabase. `PUBLIC_PROFILE_SELECT`
   (server/lib/publicProfileStore.js) omits `raw_profile`, and `mapProfileRowForApi`
   (server/lib/publicProfileMapping.js) maps only identity/score fields. Everything the collector
   harvested — appearance, macOS version, display, storage, battery, security, wifi, app usage —
   is stored in `raw_profile` (flat fields + `lastHarvestDataJson`) but never serialized to the
   API, so the overview renders `—` for most rows.
2. **Content hidden behind interaction.** Five cards use collapsible `PoFold` bodies; three start
   collapsed. The user wants zero interaction on this screen — everything visible.
3. **Empty space.** `.po-grid` is a 2-column CSS grid; row height = tallest card, so short cards
   leave large voids.
4. **No real typography hierarchy.** The AvantGarde face ships Book(400)/Demi(600)/Bold(700), but
   the CSS asks for 500/700/800 with `font-synthesis: none`, so nearly all text resolves to Bold.

## Design

### Server: compact `harvestOverview` on the API profile

New `server/lib/harvestOverview.js` exporting `buildHarvestOverview(rawProfile)`:

- Reads flat sync fields (`appearance`, `osVersion`, `ram`, `uptimeDays`, `storageUsed/Total`,
  `mostUsedApps`, `systemLanguages`, `applications`, `hardware_chip`, `batteryCycles`) and the
  stored harvest JSON (`raw.lastHarvestDataJson` → `MACHINE_IDENTITY`, `PAST_HISTORY`,
  `SCORING_DATA`), harvest JSON winning when both exist.
- Returns a compact (~2–4 KB) object; arrays capped; never includes browser URLs/titles, shell
  commands, or file paths (only counts / domains / extensions):

```
{
  machine: { name, model, chip, ram, osVersion, appearance, screenResolution, locale, languages[] },
  displays: [{ name, resolution }],
  storage: { totalGb, usedGb, freeGb, usePercent, smartStatus },
  battery: { percent, charging, powerSource, cycles, condition, healthPercent },
  memory: { pressureLevel, swapUsed },
  security: { sip, filevault, gatekeeper },
  apps: { mostUsed[], dock[], installedCount },
  network: { wifiNetworks[≤10], wifiCount },
  usage: { appUsage7d[≤8 {app,lastUsed}], recentFilesCount, downloadsCount, uptimeDays },
  browser: { topDomains[≤6 {domain,count}], totalVisits },
  files: { extensions[≤8 {ext,count}] },
  diagnostics: { crashCount7d, errorCount24h },
}
```

Omits empty sections (null) so the UI can skip rows instead of printing `—`.

Wiring: `mapProfileRowForApi` attaches `harvestOverview`; `PUBLIC_PROFILE_SELECT` gains
`raw_profile`. Unit tests with a fixture shaped like the real collector output.

### Client: data builder

`src/lib/profileOverviewData.js` prefers `profile.harvestOverview`, falling back to the flat
profile fields (keeps local filesystem mode working). New sections exposed: displays, memory,
browser domains, file extensions, diagnostics, dock apps, full wifi list, 7-day app usage.

### Client: layout & interaction

- `PoCard` becomes a static shell (no modes, chevron, fold, modal). All content always rendered.
- Stack order: Score drift → Activity patterns → Post footprint → Digital environment (machine +
  display/appearance + storage + battery + memory) → masonry column section (`columns: 2`,
  `break-inside: avoid`) with Tech stack (apps, dock, AI tools, file extensions), Security &
  health (checks + diagnostics), Network trace (full wifi list + browser domains), Harvest
  freshness, Location & languages.
- Responsive: columns collapse to 1 under 768px; stat grids use `auto-fit, minmax()`.

### Typography (Book / Demi / Bold only)

- Card titles: Bold 700, 26–28px.
- Eyebrows + section labels: Book 400, uppercase, letter-spaced, 13–14px.
- Values & emphasized numbers: Demi 600, tabular-nums.
- Body/secondary: Book 400.
- Slightly smaller scale than today (28/18/14 vs 30/22/18) to relieve the cramped feel; spacing
  does the hierarchy work instead of size.

## Out of scope

- Multi-profile semantics, feed/leaderboard tabs, Electron collector changes, Railway deploy.
