# LiveScoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hiding/revealing posts immediately change persona scores with game-quality animations, persisted to the server and the sibling Electron repo's `data/data.json`.

**Architecture:** A `LiveScoringContext` inside `App.jsx` holds hide records (localStorage-persisted), derives `adjustedScores` from them, and queues animation events consumed by a `ScoreAnimator` portal component. Hiding a post subtracts its `systemDeltaPct` from the matching persona score; revealing restores 50% (decay model). Adjusted scores replace raw profile scores everywhere — dominant persona, ring values, accent theming — so shifting enough posts can retheme the entire app. Score changes sync async to `POST /api/profile/:id/score-adjustments` (server.js), which also patches Electron's `data/data.json`.

**Tech Stack:** React 18, CSS animations, rAF loops, localStorage, Express (server.js), Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/features/liveScoring/scoringLogic.js` | Pure scoring functions (testable, no React) |
| Create | `src/features/liveScoring/LiveScoringContext.jsx` | Context provider, reducer, localStorage, animation queue |
| Create | `src/features/liveScoring/useLiveScoring.js` | Consumer hook |
| Create | `src/features/liveScoring/scoreSync.js` | Fire-and-forget server + Electron sync |
| Create | `src/features/liveScoring/liveScoring.css` | Animation keyframes only |
| Create | `src/features/liveScoring/ScoreAnimator.jsx` | Portal: particle, ring pulse, counter, persona flip overlay |
| Create | `tests/liveScoring.test.js` | Unit tests for scoringLogic.js |
| Modify | `server.js` | New `POST /api/profile/:id/score-adjustments` endpoint |
| Modify | `src/app/App.jsx` | Wrap with provider, use adjustedScores, add `data-persona-ring` attrs |
| Modify | `src/features/feed/PostCard.jsx` | Ref on system note pill, pass rect to onHide |
| Modify | `src/features/feed/PostsTab.jsx` | Use `useLiveScoring`, call `hidePost`/`revealPost` with pill rect |

---

## Task 1: Pure scoring logic + tests

**Files:**
- Create: `src/features/liveScoring/scoringLogic.js`
- Create: `tests/liveScoring.test.js`

- [ ] **Step 1: Create scoringLogic.js**

```js
// src/features/liveScoring/scoringLogic.js

export const PERSONA_TO_SCORE_KEY = {
  popularite: 'social',
  popularity: 'social',
  social: 'social',
  securite: 'security',
  security: 'security',
  productivite: 'productivity',
  productivity: 'productivity',
};

// UI axis key used on ring cards: maps score key back to UI key
export const SCORE_KEY_TO_RING_ATTR = {
  social: 'popularity',
  security: 'security',
  productivity: 'productivity',
};

/**
 * records: { [postKey]: { persona: string, delta: number, restorable: number } }
 * Returns { productivity, security, social } net adjustments.
 */
export function computeLiveAdjustments(records) {
  const adj = { productivity: 0, security: 0, social: 0 };
  for (const rec of Object.values(records)) {
    const key = PERSONA_TO_SCORE_KEY[String(rec.persona).toLowerCase()] ?? 'productivity';
    adj[key] += rec.delta;
  }
  return adj;
}

/** Clamp base + adjustments to [0, 100]. */
export function computeAdjustedScores(baseScores, liveAdjustments) {
  const clamp = (v) => Math.max(0, Math.min(100, v));
  return {
    productivity: clamp(baseScores.productivity + liveAdjustments.productivity),
    security: clamp(baseScores.security + liveAdjustments.security),
    social: clamp(baseScores.social + liveAdjustments.social),
  };
}

/**
 * Returns new records after hiding a post.
 * No-op if already hidden.
 */
export function applyHide(records, postKey, persona, systemDeltaPct) {
  if (records[postKey]) return records;
  const delta = -Math.abs(systemDeltaPct);
  return {
    ...records,
    [postKey]: {
      persona: String(persona).toLowerCase(),
      delta,
      restorable: Math.abs(systemDeltaPct) * 0.5,
    },
  };
}

/**
 * Returns new records after revealing a post (decay: restores 50%).
 * No-op if not hidden.
 */
export function applyReveal(records, postKey) {
  const rec = records[postKey];
  if (!rec) return records;
  const restored = rec.restorable ?? 0;
  if (restored === 0) {
    // Nothing to restore — remove record (hidden state cleared)
    const next = { ...records };
    delete next[postKey];
    return next;
  }
  return {
    ...records,
    [postKey]: { ...rec, delta: rec.delta + restored, restorable: 0 },
  };
}

/**
 * Returns UI persona key ('productivity' | 'security' | 'popularity')
 * for the highest-scoring axis.
 */
export function dominantPersonaFromAdjustedScores(adjustedScores) {
  const entries = [
    ['productivity', adjustedScores.productivity],
    ['security', adjustedScores.security],
    ['popularity', adjustedScores.social],
  ];
  return entries.reduce((best, curr) => (curr[1] > best[1] ? curr : best))[0];
}
```

- [ ] **Step 2: Write tests**

```js
// tests/liveScoring.test.js
import { describe, it, expect } from 'vitest';
import {
  computeLiveAdjustments,
  computeAdjustedScores,
  applyHide,
  applyReveal,
  dominantPersonaFromAdjustedScores,
} from '../src/features/liveScoring/scoringLogic.js';

describe('computeLiveAdjustments', () => {
  it('returns zeroes for empty records', () => {
    expect(computeLiveAdjustments({})).toEqual({ productivity: 0, security: 0, social: 0 });
  });

  it('sums deltas for the correct score key (French alias)', () => {
    const records = {
      key1: { persona: 'popularite', delta: -3, restorable: 1.5 },
      key2: { persona: 'popularite', delta: -2, restorable: 1 },
    };
    expect(computeLiveAdjustments(records)).toEqual({ productivity: 0, security: 0, social: -5 });
  });

  it('maps securite to security', () => {
    const records = { k: { persona: 'securite', delta: -4, restorable: 2 } };
    expect(computeLiveAdjustments(records).security).toBe(-4);
  });

  it('maps productivite to productivity', () => {
    const records = { k: { persona: 'productivite', delta: -1, restorable: 0.5 } };
    expect(computeLiveAdjustments(records).productivity).toBe(-1);
  });
});

describe('computeAdjustedScores', () => {
  it('clamps to 0 on large negative adjustment', () => {
    const base = { productivity: 2, security: 50, social: 50 };
    const adj = { productivity: -10, security: 0, social: 0 };
    expect(computeAdjustedScores(base, adj).productivity).toBe(0);
  });

  it('clamps to 100 on large positive adjustment', () => {
    const base = { productivity: 98, security: 50, social: 50 };
    const adj = { productivity: 10, security: 0, social: 0 };
    expect(computeAdjustedScores(base, adj).productivity).toBe(100);
  });

  it('applies adjustment correctly within bounds', () => {
    const base = { productivity: 60, security: 70, social: 80 };
    const adj = { productivity: -5, security: 3, social: -2 };
    expect(computeAdjustedScores(base, adj)).toEqual({ productivity: 55, security: 73, social: 78 });
  });
});

describe('applyHide', () => {
  it('adds a hide record with negative delta and restorable', () => {
    const result = applyHide({}, 'post-1', 'popularite', 3);
    expect(result['post-1']).toEqual({ persona: 'popularite', delta: -3, restorable: 1.5 });
  });

  it('is a no-op if post is already hidden', () => {
    const existing = { 'post-1': { persona: 'popularite', delta: -3, restorable: 1.5 } };
    expect(applyHide(existing, 'post-1', 'popularite', 3)).toBe(existing);
  });

  it('does not mutate the original records object', () => {
    const original = {};
    applyHide(original, 'post-1', 'popularite', 3);
    expect(original).toEqual({});
  });
});

describe('applyReveal', () => {
  it('restores 50% (restorable) to delta', () => {
    const records = { 'post-1': { persona: 'popularite', delta: -3, restorable: 1.5 } };
    const result = applyReveal(records, 'post-1');
    expect(result['post-1'].delta).toBeCloseTo(-1.5);
    expect(result['post-1'].restorable).toBe(0);
  });

  it('is a no-op if post is not in records', () => {
    const records = {};
    expect(applyReveal(records, 'post-1')).toBe(records);
  });

  it('removes record when restorable is already 0 (double reveal)', () => {
    const records = { 'post-1': { persona: 'popularite', delta: -1.5, restorable: 0 } };
    const result = applyReveal(records, 'post-1');
    expect(result['post-1']).toBeUndefined();
  });
});

describe('dominantPersonaFromAdjustedScores', () => {
  it('returns the key with the highest score', () => {
    expect(dominantPersonaFromAdjustedScores({ productivity: 40, security: 80, social: 60 })).toBe('security');
  });

  it('maps highest social score to popularity (UI key)', () => {
    expect(dominantPersonaFromAdjustedScores({ productivity: 30, security: 40, social: 90 })).toBe('popularity');
  });

  it('returns productivity on tie (first in order)', () => {
    expect(dominantPersonaFromAdjustedScores({ productivity: 50, security: 50, social: 50 })).toBe('productivity');
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose tests/liveScoring.test.js
```

Expected: All tests pass (green).

- [ ] **Step 4: Commit**

```bash
git add src/features/liveScoring/scoringLogic.js tests/liveScoring.test.js
git commit -m "feat(liveScoring): add pure scoring logic with tests"
```

---

## Task 2: Server endpoint — score-adjustments + Electron sync

**Files:**
- Modify: `server.js` (after the `DELETE /api/posts/:id` block, before `app.listen`)

- [ ] **Step 1: Add the ELECTRON_DATA_PATH constant near the top of server.js**

After the existing `const UPLOADS_DIR = ...` line, add:

```js
const ELECTRON_DATA_PATH = '/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/data.json';
```

- [ ] **Step 2: Add the endpoint — insert before `app.listen` (or before the final export)**

Find the end of `server.js` where `app.listen` is called and insert this block above it:

```js
// POST /api/profile/:id/score-adjustments
// Persists liveScoring adjustments and patches Electron data.json.
app.post('/api/profile/:id/score-adjustments', async (req, res) => {
  const id = req.params.id;
  const { scoreAdjustments } = req.body ?? {};

  if (
    !scoreAdjustments ||
    typeof scoreAdjustments !== 'object' ||
    typeof scoreAdjustments.productivity !== 'number' ||
    typeof scoreAdjustments.security !== 'number' ||
    typeof scoreAdjustments.social !== 'number'
  ) {
    return res.status(400).json({ error: 'scoreAdjustments must contain numeric productivity, security, social' });
  }

  const profilePath = path.join(PROFILES_DIR, `${id}.json`);

  try {
    // 1. Update WebDiplome profile JSON
    const raw = await fs.readFile(profilePath, 'utf8');
    const profile = JSON.parse(raw);
    profile.scoreAdjustments = scoreAdjustments;
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf8');

    // 2. Patch Electron data.json (best-effort — don't fail if missing)
    try {
      const electronRaw = await fs.readFile(ELECTRON_DATA_PATH, 'utf8');
      const electronData = JSON.parse(electronRaw);
      electronData.liveScoreAdjustments = {
        productivity: scoreAdjustments.productivity,
        security: scoreAdjustments.security,
        social: scoreAdjustments.social,
        updatedAt: new Date().toISOString(),
      };
      await fs.writeFile(ELECTRON_DATA_PATH, JSON.stringify(electronData, null, 2), 'utf8');
    } catch (electronErr) {
      // Electron repo not available — log and continue
      console.warn('[score-adjustments] Electron data.json not updated:', electronErr.message);
    }

    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: `Profile '${id}' not found` });
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Restart server and smoke-test the endpoint manually**

```bash
# In one terminal:
npm run server

# In another terminal (use the actual profile id from profiles/ dir):
ls profiles/
# e.g. profiles/brikeld-brikeld.json → id = brikeld-brikeld
curl -s -X POST http://localhost:3001/api/profile/brikeld-brikeld/score-adjustments \
  -H "Content-Type: application/json" \
  -d '{"scoreAdjustments":{"productivity":60,"security":70,"social":50}}' | python3 -m json.tool
```

Expected: `{ "ok": true }`. Check that `profiles/{id}.json` now has a `scoreAdjustments` field and that `data/data.json` in the Electron repo has a `liveScoreAdjustments` field.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(liveScoring): add score-adjustments endpoint + Electron data.json sync"
```

---

## Task 3: scoreSync.js

**Files:**
- Create: `src/features/liveScoring/scoreSync.js`

- [ ] **Step 1: Create the file**

```js
// src/features/liveScoring/scoreSync.js

const API_ORIGIN =
  (import.meta?.env?.VITE_API_ORIGIN && String(import.meta.env.VITE_API_ORIGIN)) ||
  'http://localhost:3001';

/**
 * Fire-and-forget: persists adjustedScores to the server.
 * Failures are logged but never thrown.
 */
export async function syncScoreAdjustment(profileId, adjustedScores, baseScores) {
  if (!profileId) return;

  // Net adjustments (what was applied on top of base)
  const scoreAdjustments = {
    productivity: Math.round(adjustedScores.productivity - baseScores.productivity),
    security: Math.round(adjustedScores.security - baseScores.security),
    social: Math.round(adjustedScores.social - baseScores.social),
  };

  try {
    await fetch(`${API_ORIGIN}/api/profile/${profileId}/score-adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scoreAdjustments }),
    });
  } catch (err) {
    console.warn('[liveScoring] sync failed:', err.message);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/liveScoring/scoreSync.js
git commit -m "feat(liveScoring): add scoreSync utility"
```

---

## Task 4: LiveScoringContext.jsx + useLiveScoring.js

**Files:**
- Create: `src/features/liveScoring/LiveScoringContext.jsx`
- Create: `src/features/liveScoring/useLiveScoring.js`

- [ ] **Step 1: Create LiveScoringContext.jsx**

```jsx
// src/features/liveScoring/LiveScoringContext.jsx
import { createContext, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { getPersonaScoresNormalized } from '@/lib/profileUtils.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
import {
  computeLiveAdjustments,
  computeAdjustedScores,
  applyHide,
  applyReveal,
  dominantPersonaFromAdjustedScores,
} from './scoringLogic.js';
import { syncScoreAdjustment } from './scoreSync.js';

export const LiveScoringContext = createContext(null);

const STORAGE_VERSION = 1;

function loadFromStorage(profileId) {
  try {
    const raw = localStorage.getItem(`live-scoring-${profileId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) return {};
    return parsed.records ?? {};
  } catch {
    return {};
  }
}

function saveToStorage(profileId, records) {
  try {
    localStorage.setItem(
      `live-scoring-${profileId}`,
      JSON.stringify({ version: STORAGE_VERSION, records }),
    );
  } catch {
    /* quota exceeded — ignore */
  }
}

function scoringReducer(state, action) {
  switch (action.type) {
    case 'HIDE': {
      const newRecords = applyHide(state.records, action.postKey, action.persona, action.systemDeltaPct);
      if (newRecords === state.records) return state; // no-op
      return { ...state, records: newRecords };
    }
    case 'REVEAL': {
      const newRecords = applyReveal(state.records, action.postKey);
      if (newRecords === state.records) return state; // no-op
      return { ...state, records: newRecords };
    }
    case 'LOAD':
      return { ...state, records: action.records, loaded: true };
    default:
      return state;
  }
}

export function LiveScoringProvider({ profile, children }) {
  const profileId = useMemo(() => {
    if (!profile) return null;
    const first = String(profile.firstname ?? '').trim().toLowerCase();
    const last = String(profile.lastname ?? '').trim().toLowerCase();
    return first && last ? `${first}-${last}` : null;
  }, [profile?.firstname, profile?.lastname]);

  const [state, dispatch] = useReducer(scoringReducer, { records: {}, loaded: false });
  const animationQueueRef = useRef([]);
  const animationListenersRef = useRef(new Set());

  // Load from localStorage when profileId changes
  useEffect(() => {
    if (!profileId) return;
    const records = loadFromStorage(profileId);
    dispatch({ type: 'LOAD', records });
  }, [profileId]);

  // Persist to localStorage after first load
  useEffect(() => {
    if (!profileId || !state.loaded) return;
    saveToStorage(profileId, state.records);
  }, [profileId, state.records, state.loaded]);

  const baseScores = useMemo(
    () => getPersonaScoresNormalized(profile ?? {}),
    [profile?.personaScores, profile?.persona_scores, profile?.globalScore, profile?.score],
  );

  const liveAdjustments = useMemo(
    () => computeLiveAdjustments(state.records),
    [state.records],
  );

  const adjustedScores = useMemo(
    () => computeAdjustedScores(baseScores, liveAdjustments),
    [baseScores, liveAdjustments],
  );

  const dominantPersona = useMemo(
    () => dominantPersonaFromAdjustedScores(adjustedScores),
    [adjustedScores],
  );

  // Sync to server + Electron when adjustedScores change (after first load)
  useEffect(() => {
    if (!profileId || !state.loaded) return;
    syncScoreAdjustment(profileId, adjustedScores, baseScores);
  }, [profileId, state.loaded, adjustedScores.productivity, adjustedScores.security, adjustedScores.social]);

  const pushAnimationEvent = useCallback((event) => {
    animationQueueRef.current = [...animationQueueRef.current, event];
    for (const listener of animationListenersRef.current) {
      listener([...animationQueueRef.current]);
    }
  }, []);

  const dequeueAnimation = useCallback((id) => {
    animationQueueRef.current = animationQueueRef.current.filter((e) => e.id !== id);
    for (const listener of animationListenersRef.current) {
      listener([...animationQueueRef.current]);
    }
  }, []);

  const subscribeAnimations = useCallback((fn) => {
    animationListenersRef.current.add(fn);
    return () => animationListenersRef.current.delete(fn);
  }, []);

  const hidePost = useCallback(
    (post, sourcePillRect) => {
      const postKey = normalizePostHideKey(post.createdAt);
      if (!postKey) return;
      dispatch({ type: 'HIDE', postKey, persona: post.persona, systemDeltaPct: post.systemDeltaPct ?? 1 });
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'hide',
        persona: String(post.persona ?? '').toLowerCase(),
        delta: -(post.systemDeltaPct ?? 1),
        sourcePillRect,
      });
    },
    [pushAnimationEvent],
  );

  const revealPost = useCallback(
    (post, sourcePillRect) => {
      const postKey = normalizePostHideKey(post.createdAt);
      if (!postKey) return;
      dispatch({ type: 'REVEAL', postKey });
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'reveal',
        persona: String(post.persona ?? '').toLowerCase(),
        delta: +(post.systemDeltaPct ?? 1) * 0.5,
        sourcePillRect,
      });
    },
    [pushAnimationEvent],
  );

  const isHidden = useCallback(
    (postKey) => !!state.records[String(postKey)],
    [state.records],
  );

  const value = useMemo(
    () => ({
      adjustedScores,
      dominantPersona,
      hidePost,
      revealPost,
      isHidden,
      subscribeAnimations,
      dequeueAnimation,
    }),
    [adjustedScores, dominantPersona, hidePost, revealPost, isHidden, subscribeAnimations, dequeueAnimation],
  );

  return <LiveScoringContext.Provider value={value}>{children}</LiveScoringContext.Provider>;
}
```

- [ ] **Step 2: Create useLiveScoring.js**

```js
// src/features/liveScoring/useLiveScoring.js
import { useContext } from 'react';
import { LiveScoringContext } from './LiveScoringContext.jsx';

export function useLiveScoring() {
  const ctx = useContext(LiveScoringContext);
  if (!ctx) throw new Error('useLiveScoring must be used inside LiveScoringProvider');
  return ctx;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/liveScoring/LiveScoringContext.jsx src/features/liveScoring/useLiveScoring.js
git commit -m "feat(liveScoring): add context provider and hook"
```

---

## Task 5: liveScoring.css

**Files:**
- Create: `src/features/liveScoring/liveScoring.css`

- [ ] **Step 1: Create the file**

```css
/* src/features/liveScoring/liveScoring.css */

/* ── Ring pulse on particle arrival ────────────────────────────────── */
@keyframes lsc-ring-pulse {
  0%   { transform: scale(1);    filter: drop-shadow(0 0 0px transparent); }
  40%  { transform: scale(1.18); filter: drop-shadow(0 0 18px var(--ring-accent)); }
  100% { transform: scale(1);    filter: drop-shadow(0 0 0px transparent); }
}

.dashboard-ring-card--pulse {
  animation: lsc-ring-pulse 450ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

/* ── Score number flash ─────────────────────────────────────────────── */
@keyframes lsc-score-flash-down {
  0%   { opacity: 1; }
  30%  { color: var(--sec, #759aef); }
  100% { opacity: 1; }
}

@keyframes lsc-score-flash-up {
  0%   { opacity: 1; }
  30%  { color: var(--pop, #ccf847); }
  100% { opacity: 1; }
}

.lsc-score-flash-down {
  animation: lsc-score-flash-down 550ms ease-out both;
}

.lsc-score-flash-up {
  animation: lsc-score-flash-up 550ms ease-out both;
}

/* ── Particle ──────────────────────────────────────────────────────── */
.lsc-particle {
  position: fixed;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 9999;
  /* color and position set via inline styles */
}

/* ── Persona flip overlay ───────────────────────────────────────────── */
@keyframes lsc-flip-fade {
  0%   { opacity: 0.78; }
  100% { opacity: 0; }
}

.lsc-persona-flip-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  animation: lsc-flip-fade 950ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/liveScoring/liveScoring.css
git commit -m "feat(liveScoring): add animation keyframes"
```

---

## Task 6: ScoreAnimator.jsx

**Files:**
- Create: `src/features/liveScoring/ScoreAnimator.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/features/liveScoring/ScoreAnimator.jsx
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveScoring } from './useLiveScoring.js';
import { PERSONA_TO_SCORE_KEY, SCORE_KEY_TO_RING_ATTR } from './scoringLogic.js';
import './liveScoring.css';

const PERSONA_COLORS = {
  productivity: '#D8D8D8',
  security: '#759AEF',
  popularity: '#CCF847',
  social: '#CCF847',
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getRingEl(persona) {
  const scoreKey = PERSONA_TO_SCORE_KEY[persona] ?? 'productivity';
  const ringAttr = SCORE_KEY_TO_RING_ATTR[scoreKey] ?? 'productivity';
  return document.querySelector(`[data-persona-ring="${ringAttr}"]`);
}

function animateCounter(persona, delta, duration = 520) {
  const scoreKey = PERSONA_TO_SCORE_KEY[persona] ?? 'productivity';
  const ringAttr = SCORE_KEY_TO_RING_ATTR[scoreKey] ?? 'productivity';
  const scoreEl = document.querySelector(`[data-persona-ring-score="${ringAttr}"]`);
  if (!scoreEl) return;

  const startVal = Number(scoreEl.textContent?.trim()) || 0;
  const endVal = Math.max(0, Math.min(100, startVal + delta));

  // Flash color
  const flashClass = delta < 0 ? 'lsc-score-flash-down' : 'lsc-score-flash-up';
  scoreEl.classList.remove('lsc-score-flash-down', 'lsc-score-flash-up');
  // Force reflow to restart animation
  void scoreEl.offsetWidth;
  scoreEl.classList.add(flashClass);
  setTimeout(() => scoreEl.classList.remove(flashClass), duration + 100);

  const startTime = performance.now();
  function tick(ts) {
    const progress = Math.min((ts - startTime) / duration, 1);
    const t = easeOutCubic(progress);
    scoreEl.textContent = String(Math.round(startVal + (endVal - startVal) * t));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function pulseRing(persona) {
  const el = getRingEl(persona);
  if (!el) return;
  el.classList.remove('dashboard-ring-card--pulse');
  void el.offsetWidth; // force reflow to restart
  el.classList.add('dashboard-ring-card--pulse');
  setTimeout(() => el.classList.remove('dashboard-ring-card--pulse'), 460);
}

// --- Particle component ---
function Particle({ event, onComplete }) {
  const elRef = useRef(null);

  useEffect(() => {
    const { sourcePillRect, persona } = event;
    if (!sourcePillRect) { onComplete(); return; }

    const ringEl = getRingEl(persona);
    const targetRect = ringEl?.getBoundingClientRect();
    if (!targetRect) { onComplete(); return; }

    const sx = sourcePillRect.x + sourcePillRect.width / 2;
    const sy = sourcePillRect.y + sourcePillRect.height / 2;
    const tx = targetRect.x + targetRect.width / 2;
    const ty = targetRect.y + targetRect.height / 2;
    const dx = tx - sx;
    const dy = ty - sy;
    const arcHeight = -Math.min(Math.abs(dx) * 0.45, 140) - 50;

    const DURATION = 680;
    const startTime = performance.now();

    const el = elRef.current;
    if (!el) { onComplete(); return; }

    function step(ts) {
      const raw = (ts - startTime) / DURATION;
      const progress = Math.min(raw, 1);
      const t = easeOutCubic(progress);

      const x = sx + dx * t;
      const arcY = arcHeight * Math.sin(Math.PI * progress);
      const y = sy + dy * t + arcY;

      // Fade out in the last 25%
      const opacity = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;

      el.style.left = `${x - 5.5}px`;
      el.style.top = `${y - 5.5}px`;
      el.style.opacity = String(opacity);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        // Particle arrived — trigger ring effects
        pulseRing(persona);
        animateCounter(persona, event.delta);
        onComplete();
      }
    }

    requestAnimationFrame(step);
  }, []);

  const color = PERSONA_COLORS[event.persona] ?? '#fff';
  return (
    <div
      ref={elRef}
      className="lsc-particle"
      style={{
        background: color,
        boxShadow: `0 0 14px 5px ${color}99`,
        opacity: event.type === 'reveal' ? 0.55 : 1,
        left: event.sourcePillRect ? `${event.sourcePillRect.x + event.sourcePillRect.width / 2 - 5.5}px` : '-100px',
        top: event.sourcePillRect ? `${event.sourcePillRect.y + event.sourcePillRect.height / 2 - 5.5}px` : '-100px',
      }}
    />
  );
}

// --- Persona flip overlay ---
function PersonaFlipOverlay({ persona, onComplete }) {
  const ringEl = getRingEl(persona);
  const rect = ringEl?.getBoundingClientRect();
  const cx = rect ? rect.x + rect.width / 2 : window.innerWidth * 0.85;
  const cy = rect ? rect.y + rect.height / 2 : window.innerHeight / 2;
  const color = PERSONA_COLORS[persona] ?? '#fff';

  useEffect(() => {
    const timer = setTimeout(onComplete, 960);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="lsc-persona-flip-overlay"
      style={{
        background: `radial-gradient(circle at ${cx}px ${cy}px, ${color}cc 0%, ${color}44 30%, transparent 65%)`,
      }}
    />
  );
}

// --- Main ScoreAnimator ---
export default function ScoreAnimator() {
  const { subscribeAnimations, dequeueAnimation, dominantPersona } = useLiveScoring();
  const [particles, setParticles] = useState([]);
  const [flipOverlay, setFlipOverlay] = useState(null);
  const prevDominantPersonaRef = useRef(dominantPersona);

  // Subscribe to animation queue
  useEffect(() => {
    const unsub = subscribeAnimations((queue) => {
      if (!queue.length) return;
      const latest = queue[queue.length - 1];
      setParticles((prev) => [...prev, latest]);
      dequeueAnimation(latest.id);
    });
    return unsub;
  }, [subscribeAnimations, dequeueAnimation]);

  // Detect dominant persona flip
  useEffect(() => {
    if (prevDominantPersonaRef.current !== dominantPersona) {
      setFlipOverlay({ id: Date.now(), persona: dominantPersona });
    }
    prevDominantPersonaRef.current = dominantPersona;
  }, [dominantPersona]);

  return createPortal(
    <>
      {particles.map((event) => (
        <Particle
          key={event.id}
          event={event}
          onComplete={() => setParticles((prev) => prev.filter((p) => p.id !== event.id))}
        />
      ))}
      {flipOverlay && (
        <PersonaFlipOverlay
          key={flipOverlay.id}
          persona={flipOverlay.persona}
          onComplete={() => setFlipOverlay(null)}
        />
      )}
    </>,
    document.body,
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/liveScoring/ScoreAnimator.jsx
git commit -m "feat(liveScoring): add ScoreAnimator portal with particle, ring pulse, counter, persona flip"
```

---

## Task 7: Wire App.jsx

**Files:**
- Modify: `src/app/App.jsx`

The four changes:
1. Import `LiveScoringProvider`, `ScoreAnimator`, and `useLiveScoring`
2. Wrap JSX with `<LiveScoringProvider profile={profile}>`
3. Replace `handleHidePost` / `hiddenPostIds` props with `useLiveScoring` (but since App is the provider, not a consumer, keep hide handling in PostsTab via `useLiveScoring`)
4. Replace ring values and dominant persona with adjusted scores; add `data-persona-ring` and `data-persona-ring-score` attributes

- [ ] **Step 1: Add imports at the top of App.jsx**

After the existing imports, add:

```js
import { LiveScoringProvider } from '@/features/liveScoring/LiveScoringContext.jsx';
import ScoreAnimator from '@/features/liveScoring/ScoreAnimator.jsx';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
```

- [ ] **Step 2: Extract the inner content of App into a child component**

The `LiveScoringProvider` must wrap the JSX inside `App` (since `profile` state lives there), and `ScoreAnimator` + the ring values must be able to call `useLiveScoring()`. The cleanest way is to create an inner component `AppContent` at the bottom of `App.jsx`:

```jsx
function AppContent({ profile, /* ...all the other App state */ }) {
  const { adjustedScores, dominantPersona } = useLiveScoring();
  // ... use adjustedScores for rings, dominantPersona for personaKey
}
```

However, this would require lifting all App state. A simpler approach: keep `App` as-is but split into `App` (holds state, wraps provider) and `AppInner` (uses useLiveScoring). Here is the exact restructure:

**At the bottom of App.jsx**, extract everything after `if (mainView === 'landing')` into `AppInner`:

```jsx
// Replace the current `export default function App()` with these two functions:

function AppInner({
  mainView, setMainView,
  activeTab, setActiveTab,
  profile,
  personaOverride, setPersonaOverride,
  postGen,
  harvestPhase, harvestProgress, harvestError,
  personaDeltas,
  profileScoreReplayNonce,
  handleGeneratePersonaPosts,
}) {
  const { adjustedScores, dominantPersona: liveDominantPersona } = useLiveScoring();

  // Use live dominant persona (from adjusted scores) instead of raw profile
  const personaKey = personaOverride ?? liveDominantPersona;
  const personaColor = PERSONA_COLORS[personaKey] ?? PERSONA_COLORS.productivity;
  const personaTabFill = PERSONA_TAB_FILLS[personaKey] ?? PERSONA_TAB_FILLS.productivity;
  const personaToggleLabel =
    personaKey === 'productivity' ? 'P' : personaKey === 'security' ? 'S' : '☺';

  const dashboardRingOrder = useMemo(() => {
    const others = PERSONA_KEYS.filter((k) => k !== personaKey);
    if (others.length !== 2) return [...PERSONA_KEYS];
    return [others[0], personaKey, others[1]];
  }, [personaKey]);

  const cyclePersona = () => {
    const order = ['productivity', 'popularity', 'security'];
    const idx = Math.max(0, order.indexOf(personaKey));
    setPersonaOverride(order[(idx + 1) % order.length]);
  };

  if (mainView === 'landing') {
    return <LandingPage onEnterDemo={() => setMainView('home')} />;
  }

  return (
    <div
      className={`page-outer persona-${personaKey} view-${mainView}`}
      style={{
        '--persona-accent': personaColor,
        '--tabs-capsule-fill': personaTabFill,
        '--persona-secondary': personaTabFill,
      }}
    >
      <ScoreAnimator />
      {/* ... rest of the JSX from the current return, with two key changes below ... */}
    </div>
  );
}

export default function App() {
  // Keep ALL existing state and effects EXACTLY as they are now
  // Remove: calculatedPersonaKey, personaKey, personaColor, personaTabFill, personaToggleLabel, dashboardRingOrder, cyclePersona
  // Remove: handleHidePost, hiddenPostIds state
  // Keep: everything else

  // ... (all existing useState, useEffect, useCallback, etc.)

  if (mainView === 'landing') {
    // Landing doesn't need live scoring context, render directly
    return <LandingPage onEnterDemo={() => setMainView('home')} />;
  }

  return (
    <LiveScoringProvider profile={profile}>
      <AppInner
        mainView={mainView}
        setMainView={setMainView}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        profile={profile}
        personaOverride={personaOverride}
        setPersonaOverride={setPersonaOverride}
        postGen={postGen}
        harvestPhase={harvestPhase}
        harvestProgress={harvestProgress}
        harvestError={harvestError}
        personaDeltas={personaDeltas}
        profileScoreReplayNonce={profileScoreReplayNonce}
        handleGeneratePersonaPosts={handleGeneratePersonaPosts}
      />
    </LiveScoringProvider>
  );
}
```

**Important:** In `AppInner`, copy the entire JSX from the current `App` return (the `<div className="page-outer">` block). Do NOT change it structurally — only make these two targeted edits:

- [ ] **Step 3: In AppInner's ring rendering, replace the ring value and add data attributes**

Find this block in the rings rendering (the `dashboardRingOrder.map((k) => ...)` section):

```jsx
// BEFORE (inside the map):
const value = Math.max(0, Math.min(100, getPersonaScoreForAxis(profile ?? {}, k)));
```

Replace with:
```jsx
// AFTER: use adjustedScores from context
const scoreKey = k === 'popularity' ? 'social' : k;
const value = Math.max(0, Math.min(100, adjustedScores[scoreKey] ?? 0));
```

And on the ring card `<div>`, add the `data-persona-ring` attribute:
```jsx
// BEFORE:
<div
  key={k}
  className={`dashboard-ring-card${isDominantRing ? ' dashboard-ring-card--dominant' : ''}`}
  style={{ '--ring-accent': ringColor }}
>
```

```jsx
// AFTER:
<div
  key={k}
  data-persona-ring={k}
  className={`dashboard-ring-card${isDominantRing ? ' dashboard-ring-card--dominant' : ''}`}
  style={{ '--ring-accent': ringColor }}
>
```

- [ ] **Step 4: Add data-persona-ring-score to the score number span**

Find the score number span inside the ring card (inside `dashboard-ring-score`):

```jsx
// BEFORE:
<span className="dashboard-ring-score">
  {Number.isFinite(value) ? value : '—'}
  {personaDeltas?.[axisKeyToScoreKey(k)] != null ? (
```

```jsx
// AFTER: wrap the number in its own span so ScoreAnimator can target it
<span className="dashboard-ring-score">
  <span data-persona-ring-score={k}>
    {Number.isFinite(value) ? value : '—'}
  </span>
  {personaDeltas?.[axisKeyToScoreKey(k)] != null ? (
```

(Close the extra `</span>` just before the outer `</span>` of `dashboard-ring-score`.)

- [ ] **Step 5: Remove handleHidePost and hiddenPostIds from App**

Delete the `handleHidePost` `useCallback` and the `hiddenPostIds` `useState` from `App`. Remove the `onHidePost={handleHidePost}` and `hiddenPostIds={hiddenPostIds}` props passed to `HomeTab` and `PostsTab` — `PostsTab` will get them from `useLiveScoring` directly (Task 9).

- [ ] **Step 6: Verify the app renders without errors**

```bash
npm run dev
```

Open the browser. The home and profile views should load. The rings should show values from `adjustedScores`. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/App.jsx
git commit -m "feat(liveScoring): wire App with LiveScoringProvider, adjusted scores, and data attrs"
```

---

## Task 8: Wire PostCard.jsx — system note pill ref

**Files:**
- Modify: `src/features/feed/PostCard.jsx`

- [ ] **Step 1: Add a ref to the system note pill span**

Add `useRef` to the existing import (it's already imported). Find the system note pill span:

```jsx
// BEFORE (line ~199):
<span className="post-meta-pill">
  System note [{personaLabel}] [+{systemDeltaPct}%]
</span>
```

```jsx
// AFTER:
const systemNotePillRef = useRef(null);
// (add this line near the other useRef declarations at the top of the function)
```

And on the span:
```jsx
<span ref={systemNotePillRef} className="post-meta-pill">
  System note [{personaLabel}] [+{systemDeltaPct}%]
</span>
```

- [ ] **Step 2: Change the hide button onClick to pass the pill rect**

Find the hide button:
```jsx
// BEFORE:
onClick={onHide}
```

```jsx
// AFTER:
onClick={() => onHide(systemNotePillRef.current?.getBoundingClientRect() ?? null)}
```

The `onHide` prop signature changes from `() => void` to `(rect: DOMRect | null) => void`. This is backward-compatible for callers that ignore the argument.

- [ ] **Step 3: Verify the post card still renders and hide button works**

In the browser dev server, go to home view, check that the hide button is visible and clickable (no JS errors).

- [ ] **Step 4: Commit**

```bash
git add src/features/feed/PostCard.jsx
git commit -m "feat(liveScoring): pass system note pill rect through onHide callback"
```

---

## Task 9: Wire PostsTab.jsx — use useLiveScoring

**Files:**
- Modify: `src/features/feed/PostsTab.jsx`

- [ ] **Step 1: Add imports**

```jsx
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
```

(`normalizePostHideKey` is already imported — verify and skip if so.)

- [ ] **Step 2: Replace the props signature**

```jsx
// BEFORE:
export default function PostsTab({ profile, feedContext = 'home', isGeneratingPosts = false, onHidePost, hiddenPostIds }) {
```

```jsx
// AFTER:
export default function PostsTab({ profile, feedContext = 'home', isGeneratingPosts = false }) {
```

- [ ] **Step 3: Consume useLiveScoring inside the component**

Add at the top of the function body:

```jsx
const { hidePost, revealPost, isHidden } = useLiveScoring();
```

- [ ] **Step 4: Replace the PostCard props that used onHidePost/hiddenPostIds**

```jsx
// BEFORE:
onHide={onHidePost ? () => onHidePost(p.createdAt) : undefined}
isHidden={hiddenPostIds ? hiddenPostIds.has(normalizePostHideKey(p.createdAt)) : false}
```

```jsx
// AFTER:
onHide={(rect) => {
  const hidden = isHidden(normalizePostHideKey(p.createdAt));
  if (hidden) revealPost(p, rect);
  else hidePost(p, rect);
}}
isHidden={isHidden(normalizePostHideKey(p.createdAt))}
```

- [ ] **Step 5: Update HomeTab.jsx prop removal**

Open `src/features/home/HomeTab.jsx`. Remove the `onHidePost` and `hiddenPostIds` props it receives, and remove them from where it passes to `PostsTab`. (PostsTab no longer accepts these props.)

- [ ] **Step 6: Verify full hide/reveal flow in the browser**

Start the dev server. Go to home view. Click the hide button on a post. You should see:
- The particle arc fly from the system note pill toward the sidebar
- The matching ring pulse
- The score number animate down
- The post blur (existing behavior)

Click "Show" on a hidden post. Score should animate back up (by 50%).

- [ ] **Step 7: Commit**

```bash
git add src/features/feed/PostsTab.jsx src/features/home/HomeTab.jsx
git commit -m "feat(liveScoring): wire PostsTab/HomeTab to useLiveScoring — hide/reveal with animations"
```

---

## Task 10: Persona flip smoke test + final cleanup

- [ ] **Step 1: Test persona flip in browser**

With the dev server running, check the current dominant persona (ring that is highlighted). Hide several posts of that persona type until the score drops below another persona's score. Watch for the full-screen radial gradient flash in the new persona's color. Verify the UI accent color transitions to the new persona.

- [ ] **Step 2: Verify server persistence**

Refresh the browser. Hide records should be restored from localStorage. Verify by checking that previously hidden posts are still blurred.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all existing tests pass plus the new `liveScoring.test.js` tests.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(liveScoring): complete — particle animations, ring pulse, score counter, persona flip, server sync"
```

---

## Self-Review Notes

- All animation DOM queries use `data-persona-ring` / `data-persona-ring-score` attributes, never class names — stable across CSS refactors.
- `applyReveal` with `restorable: 0` removes the record entirely so the post becomes un-hidden visually; `isHidden` returns false for it.
- `syncScoreAdjustment` fires on every `adjustedScores` change (throttled by React's batching). On mobile-speed networks, this is fire-and-forget so it never blocks the UI.
- The `LOAD` → `saveToStorage` double-write on mount is a no-op (same data) — harmless.
- `ScoreAnimator` is only mounted inside `AppInner`, which is only rendered after the `LiveScoringProvider` is in the tree. The `useLiveScoring()` call in `ScoreAnimator` will never see a null context.
- `data-persona-ring` uses the UI key (`productivity`, `security`, `popularity`) matching `PERSONA_KEYS` in App.jsx and `SCORE_KEY_TO_RING_ATTR` in scoringLogic.js.
