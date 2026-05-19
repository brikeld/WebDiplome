# LiveScoring — Design Spec
**Date:** 2026-05-19  
**Status:** Approved

---

## Overview

LiveScoring makes hiding/revealing posts have real, persistent consequences on persona scores. Hiding a post immediately subtracts that post's `systemDeltaPct` from the matching persona score. If enough social posts are hidden, the dominant persona can shift to security or productivity, rethemeing the entire app. Score changes sync to the WebDiplome server and to the sibling Electron repo's `data/data.json`.

---

## Scoring Rules

Each post has `systemDeltaPct` (1–5), deterministically derived from its persona + content. This is the "weight" of that post.

**Hide action:**
```
adjustedScore[persona] -= post.systemDeltaPct
```

**Reveal (un-hide) action — decay model:**
```
adjustedScore[persona] += post.systemDeltaPct * 0.5
```
50% of the penalty is restored. The other 50% is permanent — hiding something is a lasting signal.

**Adjusted score formula:**
```
adjustedScore[persona] = baseScore[persona] + sum(liveAdjustments[persona])
```

`adjustedScore` is clamped to `[0, 100]`. It replaces raw `personaScores` everywhere in the UI — rings, dominant persona resolution, and accent theming. The dominant persona recalculates from adjusted scores, so a real persona shift rethemes the full app.

---

## Architecture

### New folder: `src/features/liveScoring/`

```
liveScoring/
  LiveScoringContext.jsx   ← React context provider, reducer, localStorage persistence
  useLiveScoring.js        ← consumer hook for components
  ScoreAnimator.jsx        ← animation overlay (React portal, all visual fx)
  scoreSync.js             ← async server + Electron file write (fire-and-forget)
  liveScoring.css          ← animation keyframes only
```

### `LiveScoringContext.jsx`

- Holds `hideRecords: Map<postKey, { delta, persona, restored }>` — persisted to `localStorage` so it survives refresh.
- Derives `liveAdjustments: { productivity, security, social }` from the hide records.
- Exposes via context:
  - `adjustedScores` — base profile scores + live adjustments, clamped to [0, 100]
  - `hidePost(post)` — dispatches HIDE action, queues animation event
  - `revealPost(post)` — dispatches REVEAL action (with 0.5 decay), queues animation event
  - `animationQueue` — array of pending animation events consumed by `ScoreAnimator`
  - `isHidden(postKey)` — boolean for PostCard rendering

- The provider wraps the JSX returned by `App` (not `App` itself from `main.jsx`), because `profile` state lives inside `App`. `<LiveScoringProvider profile={profile}>` is placed around the page content inside `App`'s return, giving it access to the live `profile` value.
- On any hide/reveal, calls `scoreSync.syncScoreAdjustment(profileId, adjustedScores)` asynchronously.

### `useLiveScoring.js`

```js
export function useLiveScoring() {
  return useContext(LiveScoringContext);
}
```

Simple passthrough. Components import this instead of prop-drilling.

### Changes to `App.jsx`

Minimal:
1. Wrap the return with `<LiveScoringProvider profile={profile}>`.
2. Replace `getPersonaScoreForAxis(profile, k)` in the dashboard rings with `adjustedScores[k]`.
3. Replace `topPersonaFromProfile(profile)` dominant persona with one derived from `adjustedScores`.
4. Replace `handleHidePost` / `hiddenPostIds` with `hidePost` / `revealPost` / `isHidden` from `useLiveScoring`.
5. Keep `personaDeltas` (post-analysis deltas) as-is — it's a separate concern.

### Changes to `PostsTab.jsx` and `PostCard.jsx`

`PostsTab.jsx`: consume `useLiveScoring()` directly instead of receiving `onHidePost` / `hiddenPostIds` as props (optional cleanup — can be done in a follow-up; props approach also works).

`PostCard.jsx`: no changes needed. It already renders `isHidden` and calls `onHide`.

---

## Animations

`ScoreAnimator.jsx` renders via `ReactDOM.createPortal` into `document.body`. It subscribes to `animationQueue` from context and processes events sequentially (or with slight overlap). Each event contains: `{ type: 'hide'|'reveal', persona, delta, sourcePillRect, targetRingRect, oldScore, newScore }`.

### 1 — Score particle burst
- A glowing `div` (8px circle, persona-color fill + blur shadow) starts at `sourcePillRect` center.
- Animates in an arc to `targetRingRect` center using a CSS custom property path or a `requestAnimationFrame` parabola.
- Duration: 600ms, `cubic-bezier(0.22, 1, 0.36, 1)`.
- On hide: particle is solid persona color. On reveal: particle is desaturated / 50% opacity.

### 2 — Ring pulse on particle arrival
- The target ring SVG gets a class `ring--pulse` applied on particle arrival.
- Keyframe: `scale(1) → scale(1.15) → scale(1)` with a `drop-shadow` bloom in the persona color.
- Duration: 400ms. Removed after animation ends.

### 3 — Score number counter
- The ring score number animates from `oldScore` to `newScore` using a `requestAnimationFrame` lerp loop (~500ms).
- Negative delta (hide): number flashes blue (`--sec`) tint mid-count.
- Positive delta (reveal): number flashes green (`--pop`) tint mid-count.

### 4 — Dominant persona change (only on persona flip)
- Detected when `adjustedScores` causes a new dominant persona key.
- A full-screen radial gradient overlay expands from the sidebar ring position, persona color, max opacity ~70%, then fades out.
- Duration: 900ms. CSS `@keyframes` with `transform: scale(0) → scale(3)` + `opacity: 0.7 → 0`.
- The existing `transition: background-color 0.3s` on `.page-outer` handles the accent color shift underneath.

---

## Server Sync

### `scoreSync.js`

Exports `syncScoreAdjustment(profileId, adjustedScores)`. Two async writes, both fire-and-forget (failures logged, never block UI):

**1. WebDiplome server — new endpoint:**
```
POST /api/profile/:id/score-adjustments
Body: { scoreAdjustments: { productivity, security, social } }
```
`server.js` writes `scoreAdjustments` into the profile JSON. `GET /api/profiles` re-reads it and merges with `personaScores` on the fly, so the existing 30s poll naturally picks up adjusted state. No schema migration needed — it's an additive field.

**2. Electron repo — direct file write:**
Path: `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/data.json`

Read → patch `personaScores` section → write back. Ensures next harvest/generation in the Electron app uses the user-adjusted persona weights. This is the same pattern already used by `server-generate.js` (hardcoded `ELECTRON_DATA_DIR` path).

---

## New Server Endpoint

In `server.js`:

```
POST /api/profile/:id/score-adjustments
```

- Reads `profiles/{id}.json`.
- Merges `req.body.scoreAdjustments` into the profile as `scoreAdjustments`.
- Writes back.
- Returns `{ ok: true }`.

`GET /api/profiles` / `GET /api/profile/:id` already re-hydrate posts; they should also merge `scoreAdjustments` into `personaScores` when returning, so consumers see adjusted scores without any client-side math.

---

## LocalStorage Schema

Key: `live-scoring-{profileId}`  
Value:
```json
{
  "version": 1,
  "records": {
    "{postKey}": { "persona": "popularite", "delta": -3, "restorable": 1.5 }
  }
}
```

`delta` is the net adjustment applied (negative = hidden, positive = partially restored).  
`restorable` is how many points remain recoverable via reveal (starts at `systemDeltaPct / 2`; consumed on reveal).

---

## Persona Key Mapping

The post's `persona` field uses French keys (`popularite`, `securite`, `productivite`). `PERSONA_ALIASES` in `App.jsx` maps them to English. `LiveScoringContext` uses the same alias map to route adjustments to the correct `liveAdjustments` key (`social`, `security`, `productivity`).

---

## Out of Scope

- Multi-user score isolation (the app is single-profile by design).
- Undo history beyond the hide/reveal toggle.
- Score adjustments affecting badge thresholds (badges tab — follow-up).
- Any UI for viewing the full hide history.
