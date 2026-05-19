# Three-Slot Generation + Rotating Algorithmic Charts

**Date:** 2026-05-18  
**Branch:** feat/commenting-capsule → main

## Problem

1. Post generation produces 5 fixed slots every time, including one that always renders an "App Categories" chart.
2. Algorithmic slots (browser, chart, security) never vary in chart type — three chart builders existed but only App Categories ever ran.
3. Slots map to fixed personas regardless of data content.

## Solution

Collapse to **3 slots** with rotating content and data-driven persona assignment.

---

## Architecture

### Slots (3, down from 5)

| Slot | id | Content | Persona |
|---|---|---|---|
| Text | `text` | LLM-only, context from a rotating data slice | determined by slice type |
| Asset | `asset` | LLM + random file (image/pdf/screenshot) from Electron assets | image→popularite, doc→productivite |
| Chart | `chart` | LLM + algorithmically generated chart PNG | determined by chart type |

### Text Slice Pool (rotates, last 3 excluded)

| id | data source | persona | prompt key |
|---|---|---|---|
| `browser` | browser_history (chrome+safari) | popularite | `browser` |
| `wifi` | wifi_history | securite | `wifi` |
| `downloads` | recent_downloads | securite | `downloads` |
| `app_usage` | app_usage_7days | productivite | `app_usage` |

### Chart Pool (rotates, last 3 excluded)

| id | data source | persona |
|---|---|---|
| `app_categories` | installed_apps by category | productivite |
| `most_used_apps` | app_usage_7days top 15 | productivite |
| `file_extensions` | recent_files_7days by ext | productivite |
| `storage_usage` | MACHINE_IDENTITY.storage | productivite |
| `battery_hardware` | battery + RAM + uptime | productivite |
| `persona_scores` | profile.personaScores | dominant persona |
| `browser_domains` | browser_history top domains | popularite |
| `language_fingerprint` | MACHINE_IDENTITY.languages | popularite |
| `ai_tool_exposure` | installed + recently used AI apps | popularite |
| `wifi_history` | wifi_history | securite |
| `recent_downloads` | recent_downloads by size | securite |
| `security_apps` | security settings + VPN/security apps | securite |

---

## Rotation Mechanism

**Approach A — random with recency guard:**
- On each generation, read the last 3 posts with the relevant type field.
- Collect used ids: for chart slot read `post.chartType`; for text slot read `post.textSliceType`.
- Filter pool to exclude those ids. If all excluded, use full pool (graceful reset).
- Pick randomly from remaining candidates.
- Write `chartType` / `textSliceType` to the generated post JSON.

---

## Data Flow

```
prepareGenerationContext()
  → reads profile (for personaScores, storage, languages)
  → reads dataJson (Electron data.json)
  → reads existing posts (for recency lists)

generatePersonaPosts({ ..., profile, dataJson, existing })
  → text slot: pickTextSlice(dataJson, recentTextTypes) → { slice, persona, promptKey }
  → asset slot: uses assetAssignment from server-generate.js (unchanged)
  → chart slot: pickAndBuildChart(dataJson, profile, recentChartTypes) → { svg, w, h, chartType, persona }
```

---

## Files Changed

| File | Change |
|---|---|
| `server/lib/dataSlices.js` | Add `extractMostUsedAppsSlice`, `extractStorageSlice`, `extractSecuritySlice`, `extractAIToolsSlice`, `formatAppUsageAsText` |
| `server/lib/chartGenerator.js` | Add 9 new chart builders; replace `resolveChartRasterSpec` with `pickAndBuildChart(dataJson, profile, excludeTypes)` |
| `server/lib/personaPostGenerator.js` | Collapse to 3 slots; add TEXT_SLICE_POOL + CHART_POOL rotation; export `ASSET_SLOT_INDEX = 1` |
| `server/lib/prompts.js` | Update `chart` prompt to be generic; add `app_usage` prompt |
| `server-generate.js` | Use `ASSET_SLOT_INDEX`; pass `profile` to `generatePersonaPosts` |
