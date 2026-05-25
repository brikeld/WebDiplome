# Chart System Redesign
**Date:** 2026-05-25  
**Scope:** `server/lib/chartGenerator.js`, `server/lib/dataSlices.js`

---

## Goal

Redesign all 12 existing SVG chart generators plus add 2 new ones (14 total) with:

1. **Unique visualization type per chart** — no two charts can share the same visual form
2. **More internal padding** — minimum 40px margins all sides, 56px+ where labels need room
3. **Swiss minimal aesthetic** — SF Mono throughout, flat fills, opacity for hierarchy, no gradients or drop-shadows, thin rules (0.5–1px)
4. **Same persona color system** — bg = persona accent, text = #000, data viz elements = #fff

---

## Color Palette (unchanged)

| Persona | Background | Text | Data viz |
|---|---|---|---|
| `productivite` | `#D8D8D8` | `#000000` | `#ffffff` |
| `securite` | `#759AEF` | `#000000` | `#ffffff` |
| `popularite` | `#CCF847` | `#000000` | `#ffffff` |

---

## Chart Registry (14 charts)

### Productivité persona (gray bg)

#### 1. `app_categories` → Vertical Column Chart
- **Data:** `extractAppCategorySlice(data).byCategory` — `[category, count][]`
- **Visual:** Bars rising from a baseline. Up to 7 categories. Column width = `(chartWidth - margins) / N`. Value label above each bar. Category label below baseline, truncated to 10 chars.
- **Dimensions:** W=640, H=320. Margins: ML=40, MR=40, MT=56, MB=52 (label row).
- **SVG elements:** `<rect>` per bar, `<line>` baseline, `<text>` for labels and values.

#### 2. `most_used_apps` → Dot Timeline
- **Data:** `extractMostUsedAppsSlice(data).apps` — `[{app, last_used}]`, up to 10 apps
- **Visual:** Horizontal time axis at bottom spanning "7d ago" → "now". Each app is a circle plotted at its `last_used` date. Apps stagger across 2 rows to avoid label overlap. Vertical dashed drop-line from dot to axis.
- **Dimensions:** W=640, H=280. ML=40, MR=40, MT=40, MB=56.
- **SVG elements:** `<line>` axis, `<circle>` dots, `<line stroke-dasharray>` drop-lines, `<text>` labels.

#### 3. `file_extensions` → Treemap
- **Data:** `buildFileExtSlice(data)` — `[ext, count][]`, up to 8 types
- **Visual:** Rectangle tiles packed into the chart area, sized proportionally to count. Labels (extension + count) inside each tile. Opacity decreases with rank.
- **Dimensions:** W=640, H=360. Padding inside chart area: 16px on all sides. Each tile has 2px gap.
- **Algorithm:** Simple row-based squarification — sort descending, fill first row until remaining items fit better in a new row.
- **SVG elements:** `<rect>` tiles, `<text>` extension + count inside each.

#### 4. `storage_usage` → Donut Gauge
- **Data:** `extractStorageSlice(data)` — `{usePct, used, free, total}`
- **Visual:** Single ring arc showing used percentage. Ring cx = chart-left-third, centered vertically. Large percentage number inside ring. Used/Free/Total text panel to the right.
- **Dimensions:** W=640, H=280. Ring: cx=180, cy=140, r=90, strokeWidth=18.
- **SVG elements:** Two `<circle>` (track + fill), `<text>` center label, stat text right side.

#### 5. `battery_hardware` → Spec Sheet
- **Data:** `data.MACHINE_IDENTITY` — `model_name`, `hardware_snapshot.chip`, `hardware_snapshot.ram || profile.ram`, battery from `extractBatterySlice` — `{condition, cycleCount}`
- **Visual:** 2×2 grid divided by thin hairlines. Top-left: machine model name. Top-right: chip name. Bottom-left: RAM (large number). Bottom-right: battery condition + cycle count.
- **Dimensions:** W=640, H=280. Internal cells: 2 cols × 2 rows, dividers at x=320, y=153.
- **SVG elements:** `<line>` dividers, `<text>` labels/values with size hierarchy (label=10px dim, value=24–28px bold, sub=11px dim).

#### 6. `file_heatmap` *(new)* → Vertical Column Chart (hourly bins)
- **Persona:** `productivite`
- **Data:** New `extractFileHeatmapSlice(data)` — parse `PAST_HISTORY.recent_files_7days[].date`, extract hour (0–23), return `counts[24]` integer array.
- **Visual:** 24 thin columns, one per hour of day. Bar height proportional to file count in that hour. Hour labels (0, 6, 12, 18, 23) below axis. Peak hour annotated. Same visual language as `app_categories` but denser (24 bars vs 7).
- **Dimensions:** W=640, H=280. ML=40, MR=40, MT=56, MB=52. Bar width = `(W - ML - MR) / 24 - 3`.
- **New data function in `dataSlices.js`:**
  ```js
  export function extractFileHeatmapSlice(data) {
    const files = Array.isArray(data?.PAST_HISTORY?.recent_files_7days) ? data.PAST_HISTORY.recent_files_7days : [];
    const counts = new Array(24).fill(0);
    for (const f of files) {
      const d = f.date ? new Date(f.date) : null;
      if (d && !isNaN(d)) counts[d.getHours()]++;
    }
    return { counts, total: files.length };
  }
  ```
- **Fallback:** If total === 0, return null (skip chart).

#### 7. `app_recency` *(new)* → Dot Timeline (weekly grid)
- **Persona:** `productivite`
- **Data:** New `extractAppRecencySlice(data)` — `PAST_HISTORY.app_usage_7days[].{app, last_used}`, top 8 apps. Compute "days ago" for each (0=today … 6=6 days ago).
- **Visual:** Horizontal grid — 7 column positions (one per day, labeled Mon–Sun or "today", "1d", …"6d"). Each of the 8 apps gets a row. Filled white circle = "used on this day". Empty circle (ring only, opacity 0.3) = "not used this day". App name label on the left.
- **Dimensions:** W=640, H=variable (56 + 8×40 + 40). ML=160 (app labels), MR=40. Columns evenly spaced across remaining width.
- **New data function in `dataSlices.js`:**
  ```js
  export function extractAppRecencySlice(data) {
    const apps = Array.isArray(data?.PAST_HISTORY?.app_usage_7days) ? data.PAST_HISTORY.app_usage_7days : [];
    const now = Date.now();
    return apps.slice(0, 8).map(({ app, last_used }) => {
      const d = last_used ? new Date(last_used) : null;
      const daysAgo = d && !isNaN(d) ? Math.round((now - d.getTime()) / 86400000) : null;
      return { app, daysAgo };
    });
  }
  ```
- **Rendering:** For each app row, draw 7 circle positions (days 0–6). If `daysAgo` matches the column index → filled circle; else empty ring. This creates the "activity trail" effect.
- **Fallback:** If fewer than 3 apps have valid `last_used` dates, return null.

---

### Sécurité persona (blue bg)

#### 8. `wifi_history` → Frequency Strips
- **Data:** `extractWifiSlice(data).networks` — string array, up to 10 networks
- **Visual:** One horizontal strip per network. Strip width = proportional to rank (first = full width, each subsequent = 85% of previous). Opacity also decreases with rank. Network name left-aligned inside strip.
- **Dimensions:** W=640, H=variable (56 + N×26 + 40). Strip height=18px, gap=8px. ML=16, MR=16.

#### 9. `recent_downloads` → Lollipop Chart
- **Data:** `buildDownloadsChart` data — `PAST_HISTORY.recent_downloads`, up to 8 items, filtered for non-hidden files
- **Visual:** For each download: filename label on the left (truncated 24 chars), thin horizontal line extending right, filled circle at the tip. Circle x-position proportional to file size (log scale if range is large). Size label to the right of circle.
- **Dimensions:** W=640, H=variable (56 + N×26 + 40). ML=200 (label), MR=80, line area = W-ML-MR.

#### 10. `security_apps` → Status Board
- **Data:** `extractSecuritySlice(data)` — `{sip, filevault, gatekeeper, securityApps[]}`
- **Visual:** Top row: 3 equal-width white blocks with setting name (small, dim) and status value (large bold). ok = full opacity, not-ok = low opacity. Bottom row: installed security tool names as pill badges.
- **Dimensions:** W=640, H=260. Block height=80px, MT=40, gap=8px between blocks.

---

### Popularité persona (lime bg)

#### 11. `browser_domains` → Stacked Proportional Bar
- **Data:** `extractBrowserSlice(data).topDomains` — `[{domain, count}]`, up to 8 domains
- **Visual:** Single full-width bar, divided into segments, each segment width proportional to visit share. Segment opacity decreases with rank. Domain labels above their segment (top 4 only, skipped if segment too narrow). Percentage labels below.
- **Dimensions:** W=640, H=220. Bar: x=40, w=560, y=70, h=52.

#### 12. `language_fingerprint` → Bold Type Tiles
- **Data:** `data.MACHINE_IDENTITY.languages || profile.systemLanguages` — string array
- **Visual:** Language code in large bold type inside a white rectangle. First language = largest tile (spans ~40% width). Subsequent tiles shrink. Tile opacity decreases with rank.
- **Dimensions:** W=640, H=200. Tiles in a single row, varying widths.

#### 13. `ai_tool_exposure` → Ranked List
- **Data:** `extractAIToolsSlice(data).tools` — `[{name, installed, recentlyUsed}]`
- **Visual:** Numbered rows (01, 02…). Row background fill: full white opacity = installed + recently used; ~40% opacity + outline = installed only; no background, dimmed text = not installed. Number dim on left, tool name center, status label right.
- **Dimensions:** W=640, H=variable (40 + N×28 + 24). ML=40, MR=40.

---

### Dynamic persona

#### 14. `persona_scores` → Radial Bars
- **Data:** `normalizePersonaPercentTriplet(profile.personaScores)` — `{productivity, security, social}`
- **Visual:** 3 concentric arc rings. Outer = Productivity (r=96), Middle = Security (r=68), Inner = Social (r=40). strokeWidth=14 for all. Track ring (opacity 0.1). Arc fill = white, stroke-linecap=round. Global score in center (large bold number + "global" label). Labels for each ring positioned just outside at 3 o'clock.
- **Dimensions:** W=640, H=340. Ring center: cx=240, cy=180.

---

## Padding Standard

All charts use a minimum of **40px** on all sides. Charts with axis labels use **52–56px** on the axis side. Text never gets closer than **16px** to the SVG edge.

Previous charts had margins as tight as 18–20px. All have been expanded.

---

## Chart Pool Updates

Add two entries to `CHART_POOL` in `chartGenerator.js`:

```js
{
  id: 'file_heatmap',
  persona: 'productivite',
  build: (data, _profile, persona) => buildFileHeatmapChart(data, persona),
},
{
  id: 'app_recency',
  persona: 'productivite',
  build: (data, _profile, persona) => buildAppRecencyChart(data, persona),
},
```

---

## Files Changed

| File | Change |
|---|---|
| `server/lib/chartGenerator.js` | Rewrite all 12 existing builder functions; add `buildFileHeatmapChart`, `buildAppRecencyChart`; add 2 entries to `CHART_POOL` |
| `server/lib/dataSlices.js` | Add `extractFileHeatmapSlice`, `extractAppRecencySlice` |

No frontend changes. Charts are PNG images served from `/uploads/` — the React components are unchanged.

---

## Constraints

- Pure SVG string generation — no browser libraries. All geometry computed in JS.
- `sharp` (librsvg) renders the SVG. Supported: `<path d>`, `<circle>`, `<rect>`, `<line>`, `<text>`, `<polygon>`, inline `style` with `transform`. Not supported: CSS keyframes, filters, foreignObject.
- Treemap layout: simple row-based packing (not full Bruls squarified) — sufficient for 4–8 items.
- All `<text>` uses `font-family="'SF Mono',monospace"`.
