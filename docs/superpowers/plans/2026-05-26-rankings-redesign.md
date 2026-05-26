# Rankings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote leaderboard posts to first-class behavior — partial "hide my position only" flow, per-board persona colors that flow correctly, LLM-generated per-entry rationales surfaced in the inference panel, and persona-grouped sections on the profile Leaderboards tab.

**Architecture:** Two-layer change. Server (`server/lib/personaPostGenerator.js`, `server/lib/leaderboards.js`, `server/lib/prompts.js`) gains a deterministic `cloneHidden` seeder, a second LM Studio call per leaderboard post that emits a 5-row `rationales[]`, and a template-based fallback so the panel always has content. Client (`src/features/feed/`, `src/features/liveScoring/`, `src/features/inferenceChain/`, `src/features/profile/tabs/`) gains a `leaderboard-self|<boardId>` record kind in the existing `LiveScoringContext`, a hidden-row variant on `LeaderboardBlock`, a new `LeaderboardRationaleView` inside the inference panel, and a persona-grouped layout on `LeaderboardsTab`.

**Tech Stack:** Node 18+ (ESM) for both servers, React 18 + Vite for the SPA, Vitest for unit tests, plain CSS with design tokens (no preprocessor). LM Studio for generation (OpenAI-compatible `/v1/chat/completions`).

**Source spec:** [docs/superpowers/specs/2026-05-26-rankings-redesign-design.md](../specs/2026-05-26-rankings-redesign-design.md)

---

## Pre-flight (every fresh agent does this once)

Skim these before touching code so the surrounding patterns are clear:
- `src/features/liveScoring/scoringLogic.js` — reducer helpers (`applyHide`, `applyReveal`, `applyCommentBoost`, `computeLiveAdjustments`). New helpers must match this shape.
- `server/lib/personaPostGenerator.js:525-563` — current `buildLeaderboardSlot`. The new LLM call slots in here.
- `server/lib/personaPostGenerator.js:350-412` — `parsePostResponse`. The rationales parser will use the same JSON-extraction pattern.
- `server/lib/leaderboards.js:33-48` — `seededFloat` + `scoreCloneFor` patterns. `cloneHiddenForBoard` uses the same primitive.
- `tests/dashboardUpdateFlow.test.js` — local Vitest convention. New tests follow the same import/describe/it shape.

**Run tests with `npm test` (vitest run, no watch).** **Run app with `npm run servers` + `npm run dev` in two terminals.**

---

## Task 1: `cloneHiddenForBoard` helper + unit test

**Files:**
- Modify: `server/lib/leaderboards.js`
- Test: `tests/leaderboards.cloneHidden.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/leaderboards.cloneHidden.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { cloneHiddenForBoard, FAKE_CLONE_COUNT } from '../server/lib/leaderboards.js';

describe('cloneHiddenForBoard', () => {
  it('returns one boolean per clone', () => {
    const out = cloneHiddenForBoard('most_productive');
    expect(out).toHaveLength(FAKE_CLONE_COUNT);
    out.forEach((v) => expect(typeof v).toBe('boolean'));
  });

  it('is deterministic for the same boardId', () => {
    expect(cloneHiddenForBoard('most_secure')).toEqual(cloneHiddenForBoard('most_secure'));
  });

  it('varies between boards (at least two distinct masks across all 7)', () => {
    const ids = [
      'most_productive', 'closest_to_burnout', 'most_likely_change_jobs',
      'ignoring_health', 'most_secure', 'most_socially_isolated', 'most_likely_ghost',
    ];
    const masks = new Set(ids.map((id) => cloneHiddenForBoard(id).join(',')));
    expect(masks.size).toBeGreaterThanOrEqual(2);
  });

  it('hides roughly 1 in 4 clones across all 7 boards (>0, <FAKE_CLONE_COUNT*7)', () => {
    const ids = [
      'most_productive', 'closest_to_burnout', 'most_likely_change_jobs',
      'ignoring_health', 'most_secure', 'most_socially_isolated', 'most_likely_ghost',
    ];
    const total = ids.reduce((acc, id) => acc + cloneHiddenForBoard(id).filter(Boolean).length, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(FAKE_CLONE_COUNT * ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/leaderboards.cloneHidden.test.js`
Expected: FAIL — `cloneHiddenForBoard is not a function` (import error).

- [ ] **Step 3: Add `cloneHiddenForBoard` to `server/lib/leaderboards.js`**

Add this export near `scoreCloneFor` (around line 48):

```js
/**
 * Deterministic "which clones have hidden their position" mask for a board.
 * Stable across reloads — uses the same seededFloat primitive as scoreCloneFor,
 * but does NOT include the drift bucket (hidden state shouldn't change every 10 min).
 */
export function cloneHiddenForBoard(boardId) {
  const mask = new Array(FAKE_CLONE_COUNT);
  for (let i = 0; i < FAKE_CLONE_COUNT; i++) {
    mask[i] = seededFloat(`hidden|${boardId}|${i}`) > 0.75;
  }
  return mask;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/leaderboards.cloneHidden.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/lib/leaderboards.js tests/leaderboards.cloneHidden.test.js
git commit -m "feat(leaderboards): add deterministic cloneHiddenForBoard mask"
```

---

## Task 2: Persist `cloneHidden` + explicit `persona` on the leaderboard slot

**Files:**
- Modify: `server/lib/personaPostGenerator.js:525-563` (`buildLeaderboardSlot`)

No new test — the existing `tests/` don't cover `buildLeaderboardSlot` shape and a snapshot here would be brittle. Verification is by manual `npm run server:generate` + JSON inspection in Task 4 once the LLM call is also wired.

- [ ] **Step 1: Add `cloneHiddenForBoard` to the existing import in `server/lib/personaPostGenerator.js:27`**

Change:
```js
import { pickBoardToPost } from './leaderboards.js';
```
to:
```js
import { pickBoardToPost, cloneHiddenForBoard } from './leaderboards.js';
```

- [ ] **Step 2: Inside `buildLeaderboardSlot`, after the `pick` line, compute the mask**

Locate `const { board, standing, prevRank } = pick;` (around line 529). Immediately below, add:

```js
const cloneHidden = cloneHiddenForBoard(board.id);
```

- [ ] **Step 3: Extend the persisted `leaderboard` object in the return value**

In the `leaderboard: { ... }` block (around line 547), add `persona` and `cloneHidden`:

```js
leaderboard: {
  boardId: board.id,
  title: board.title,
  persona: board.persona,            // NEW
  cloneHidden,                       // NEW (4-element boolean array)
  userRank: standing.userRank,
  previousUserRank: prevRank,
  entries: standing.entries.map((e) => ({
    rank: e.rank,
    name: e.name,
    handle: e.handle,
    avatarSrc: e.avatarSrc,
    avatarInitials: e.avatarInitials,
    score: e.score,
    isUser: e.isUser,
  })),
},
```

- [ ] **Step 4: Commit (no rationales yet — those land in Task 4)**

```bash
git add server/lib/personaPostGenerator.js
git commit -m "feat(leaderboards): persist cloneHidden + explicit persona on post.leaderboard"
```

---

## Task 3: Add `leaderboard_rationales` prompt + `RATIONALE_TEMPLATES` fallback table

**Files:**
- Modify: `server/lib/prompts.js`

- [ ] **Step 1: Add the new slot prompt to `DEFAULT_SLOT_PROMPTS`**

In `server/lib/prompts.js`, after the `leaderboard:` entry (around line 41), add:

```js
  leaderboard_rationales: {
    system: `You write very short rationales for a satirical surveillance leaderboard. You will be given a board title, the board's scoring rule in plain English, and 5 entries with rank + score + isUser + hidden. For the ONE entry marked "isUser":true, use the provided real signal hint to ground the rationale. For each clone (isUser:false), you may invent a short personality line, BUT the "signal" field for clones must ONLY restate "score N · yours M" (where N is the clone's score and M is the user's score) — never invent app counts, file counts, or any other fabricated data. For any entry marked "hidden":true, emit phrase:null and signal:null. Phrases are lower-case, max 90 chars, no hashtags, no emojis. Return ONLY valid JSON: {"rationales":[{"rank":1,"phrase":"...","signal":"..."}, ...]} with exactly 5 entries, one per rank, in ascending rank order. /no_think`,
    temperature: 0.6,
    maxTokens: 600,
  },
```

- [ ] **Step 2: Add a per-board template fallback table**

At the bottom of `server/lib/prompts.js` (after `DEFAULT_PROMPTS`), add:

```js
/**
 * Per-board fallback rationales used when the LM Studio rationales call fails
 * or returns malformed JSON. selfPhrase is used for the user; clonePhrases[] is
 * cycled by clone index. Signals are filled in at runtime ("score N · yours M").
 */
export const RATIONALE_TEMPLATES = {
  most_productive: {
    selfPhrase: 'shipping more than you sleep',
    clonePhrases: [
      'quietly outproducing the room',
      'mostly creative tools today',
      'late-night work bursts',
      'one big push, then silence',
    ],
  },
  closest_to_burnout: {
    selfPhrase: 'editing files past midnight again',
    clonePhrases: [
      'no social apps in days',
      'work app open all weekend',
      'back-to-back since dawn',
      'inbox at 1am energy',
    ],
  },
  most_likely_change_jobs: {
    selfPhrase: 'tab open on a job board',
    clonePhrases: [
      'glassdoor-curious this week',
      'low file output, high comms',
      'recruiter dm season',
      'updating the resume quietly',
    ],
  },
  ignoring_health: {
    selfPhrase: 'no health app installed and it shows',
    clonePhrases: [
      'café wifi, late-night files',
      'screen time off the chart',
      'fitness app last opened: never',
      'snack runs as cardio',
    ],
  },
  most_secure: {
    selfPhrase: 'vpn on, torrents off',
    clonePhrases: [
      'fewest networks joined',
      'paranoid in a good way',
      'firewall hobbyist energy',
      'never on public wifi',
    ],
  },
  most_socially_isolated: {
    selfPhrase: 'one wifi network, zero pings',
    clonePhrases: [
      'social apps untouched today',
      'lone wolf signal',
      'one chat tab, all week',
      'group chats on mute',
    ],
  },
  most_likely_ghost: {
    selfPhrase: 'reads but doesn’t reply',
    clonePhrases: [
      'comms app open, no sends',
      'last seen yesterday',
      'half-typed messages everywhere',
      'inbox at 0, replies at 0',
    ],
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add server/lib/prompts.js
git commit -m "feat(prompts): add leaderboard_rationales slot prompt + per-board fallback templates"
```

---

## Task 4: Generate rationales in `buildLeaderboardSlot` (with LLM call + fallback)

**Files:**
- Modify: `server/lib/personaPostGenerator.js`
- Create: `server/lib/leaderboardRationales.js` (extracted helper — keeps `personaPostGenerator.js` from growing further)
- Test: `tests/leaderboardRationales.test.js`

The helper module isolates parsing + fallback so it's unit-testable without booting LM Studio.

- [ ] **Step 1: Write the failing helper tests**

Create `tests/leaderboardRationales.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  parseRationalesResponse,
  fallbackRationales,
  buildRationalesPayload,
} from '../server/lib/leaderboardRationales.js';

const STANDING = {
  entries: [
    { rank: 1, score: 61, isUser: false },
    { rank: 2, score: 55, isUser: false },
    { rank: 3, score: 47, isUser: true },
    { rank: 4, score: 40, isUser: false },
    { rank: 5, score: 30, isUser: false },
  ],
  hint: '4 work app(s), 2 creative app(s), 1 entertainment app(s) used recently.',
};
const CLONE_HIDDEN = [false, true, false, false]; // 4 clones; index 1 hidden
const BOARD = { id: 'most_productive', title: 'Top 5 Most Productive' };

describe('parseRationalesResponse', () => {
  it('accepts well-formed JSON with 5 entries', () => {
    const raw = JSON.stringify({
      rationales: [
        { rank: 1, phrase: 'shipping a lot', signal: 'score 61 · yours 47' },
        { rank: 2, phrase: null, signal: null },
        { rank: 3, phrase: 'late-night grind', signal: '4 work, 2 creative' },
        { rank: 4, phrase: 'mostly creative', signal: 'score 40 · yours 47' },
        { rank: 5, phrase: 'low effort today', signal: 'score 30 · yours 47' },
      ],
    });
    const out = parseRationalesResponse(raw);
    expect(out).toHaveLength(5);
    expect(out[0].phrase).toBe('shipping a lot');
    expect(out[1].phrase).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    expect(parseRationalesResponse('not json')).toBeNull();
    expect(parseRationalesResponse(JSON.stringify({ rationales: [] }))).toBeNull();
    expect(parseRationalesResponse(JSON.stringify({ rationales: new Array(4).fill({}) }))).toBeNull();
  });

  it('coerces ranks to ascending order if model returns shuffled', () => {
    const raw = JSON.stringify({
      rationales: [
        { rank: 3, phrase: 'c', signal: 's3' },
        { rank: 1, phrase: 'a', signal: 's1' },
        { rank: 5, phrase: 'e', signal: 's5' },
        { rank: 2, phrase: 'b', signal: 's2' },
        { rank: 4, phrase: 'd', signal: 's4' },
      ],
    });
    const out = parseRationalesResponse(raw);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(out.map((r) => r.phrase)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('truncates phrases over 90 chars', () => {
    const longPhrase = 'x'.repeat(200);
    const raw = JSON.stringify({
      rationales: [
        { rank: 1, phrase: longPhrase, signal: 's' },
        { rank: 2, phrase: 'ok', signal: 's' },
        { rank: 3, phrase: 'ok', signal: 's' },
        { rank: 4, phrase: 'ok', signal: 's' },
        { rank: 5, phrase: 'ok', signal: 's' },
      ],
    });
    const out = parseRationalesResponse(raw);
    expect(out[0].phrase.length).toBeLessThanOrEqual(90);
  });
});

describe('fallbackRationales', () => {
  it('emits 5 entries aligned with entries[]', () => {
    const out = fallbackRationales(BOARD, STANDING, CLONE_HIDDEN);
    expect(out).toHaveLength(5);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('uses selfPhrase for the user entry', () => {
    const out = fallbackRationales(BOARD, STANDING, CLONE_HIDDEN);
    expect(out[2].phrase).toBe('shipping more than you sleep'); // rank 3 = user
    expect(out[2].signal).toBe(STANDING.hint);
  });

  it('emits null phrase + null signal for hidden clones', () => {
    // CLONE_HIDDEN[1] = true means the 2nd clone (in clone order) is hidden.
    // Clones in rank order (skipping user at rank 3): rank 1, 2, 4, 5 → clone indices 0,1,2,3
    const out = fallbackRationales(BOARD, STANDING, CLONE_HIDDEN);
    expect(out[1].phrase).toBeNull(); // rank 2 = clone idx 1 = hidden
    expect(out[1].signal).toBeNull();
  });

  it('clone signals use "score N · yours M" format', () => {
    const out = fallbackRationales(BOARD, STANDING, CLONE_HIDDEN);
    expect(out[0].signal).toBe('score 61 · yours 47');
    expect(out[3].signal).toBe('score 40 · yours 47');
    expect(out[4].signal).toBe('score 30 · yours 47');
  });
});

describe('buildRationalesPayload', () => {
  it('includes board title, hint description, and 5 entries with hidden flag', () => {
    const payload = buildRationalesPayload(BOARD, STANDING, CLONE_HIDDEN);
    expect(payload).toContain('Top 5 Most Productive');
    expect(payload).toContain('4 work app');
    expect(payload).toContain('"hidden":true');
    expect((payload.match(/"rank":/g) || [])).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/leaderboardRationales.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `server/lib/leaderboardRationales.js`**

```js
/**
 * Per-entry rationale generation + parsing for leaderboard posts.
 * Pure module (no I/O) — the LM Studio call itself happens in personaPostGenerator.js
 * via the shared lmChatCompletion helper.
 */

import { RATIONALE_TEMPLATES } from './prompts.js';

const PHRASE_MAX = 90;
const RATIONALE_COUNT = 5;

function truncate(s) {
  if (typeof s !== 'string') return null;
  return s.length > PHRASE_MAX ? s.slice(0, PHRASE_MAX) : s;
}

function normalizeOne(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rank = Number(raw.rank);
  if (!Number.isInteger(rank) || rank < 1 || rank > RATIONALE_COUNT) return null;
  const phrase = raw.phrase == null ? null : truncate(String(raw.phrase));
  const signal = raw.signal == null ? null : String(raw.signal);
  return { rank, phrase, signal };
}

/**
 * Returns 5 normalized rationale rows in ascending rank order, or null if the
 * response is unusable (caller falls back to templates).
 */
export function parseRationalesResponse(rawText) {
  if (typeof rawText !== 'string') return null;
  let obj;
  try {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (!m) return null;
    obj = JSON.parse(m[0]);
  } catch {
    return null;
  }
  if (!obj || !Array.isArray(obj.rationales) || obj.rationales.length !== RATIONALE_COUNT) {
    return null;
  }
  const normalized = obj.rationales.map(normalizeOne).filter(Boolean);
  if (normalized.length !== RATIONALE_COUNT) return null;
  normalized.sort((a, b) => a.rank - b.rank);
  const ranks = normalized.map((r) => r.rank);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return null;
  return normalized;
}

/**
 * Build the LM Studio user-message payload for a rationales call.
 */
export function buildRationalesPayload(board, standing, cloneHidden) {
  const userScore = standing.entries.find((e) => e.isUser)?.score ?? 0;
  let cloneIdx = -1;
  const rows = standing.entries.map((e) => {
    if (e.isUser) {
      return { rank: e.rank, score: Math.round(e.score), isUser: true, hidden: false };
    }
    cloneIdx += 1;
    return {
      rank: e.rank,
      score: Math.round(e.score),
      isUser: false,
      hidden: Boolean(cloneHidden[cloneIdx]),
    };
  });
  return [
    `Board: ${board.title}`,
    `Scoring rule (plain English): ${standing.hint}`,
    `User score: ${Math.round(userScore)}`,
    `Entries:`,
    JSON.stringify(rows),
  ].join('\n');
}

/**
 * Deterministic template-based fallback. Always returns 5 entries.
 */
export function fallbackRationales(board, standing, cloneHidden) {
  const tpl = RATIONALE_TEMPLATES[board.id] ?? {
    selfPhrase: 'classified by the algorithm',
    clonePhrases: ['', '', '', ''],
  };
  const userScore = Math.round(standing.entries.find((e) => e.isUser)?.score ?? 0);
  let cloneIdx = -1;
  return standing.entries.map((e) => {
    if (e.isUser) {
      return { rank: e.rank, phrase: tpl.selfPhrase, signal: standing.hint };
    }
    cloneIdx += 1;
    if (cloneHidden[cloneIdx]) {
      return { rank: e.rank, phrase: null, signal: null };
    }
    const phrase = tpl.clonePhrases[cloneIdx % tpl.clonePhrases.length] || 'in your zone';
    return { rank: e.rank, phrase, signal: `score ${Math.round(e.score)} · yours ${userScore}` };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/leaderboardRationales.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Wire the LM Studio call into `buildLeaderboardSlot`**

`buildLeaderboardSlot` is synchronous today (no LM call inside) and returns a slot object that the slot runner later sends to LM Studio. We need a second call specifically for rationales. To keep the change small, do the second call inside `runSlot` only for the leaderboard slot, after the main post completes.

In `server/lib/personaPostGenerator.js`, add at the top with the other helper imports:

```js
import {
  parseRationalesResponse,
  buildRationalesPayload,
  fallbackRationales,
} from './leaderboardRationales.js';
```

Inside `runSlot` (around line 629, just before the `if (slot.leaderboard) post.leaderboard = slot.leaderboard;` line), add:

```js
if (slot.leaderboard && slot.leaderboardContext) {
  const { board, standing, cloneHidden } = slot.leaderboardContext;
  const ratPromptCfg = SP.leaderboard_rationales ?? null;
  let rationales = null;
  if (ratPromptCfg) {
    try {
      const ratBody = buildChatBody({
        model: slot._model,
        systemPrompt: ratPromptCfg.system,
        userPayload: buildRationalesPayload(board, standing, cloneHidden),
        imageData: null,
        docText: null,
        docFilename: null,
        temperature: ratPromptCfg.temperature,
        maxTokens: ratPromptCfg.maxTokens,
      });
      const ratResp = await lmChatCompletion({ baseUrl, timeoutMs, retries, body: ratBody });
      rationales = parseRationalesResponse(extractChoiceText(ratResp));
    } catch {
      rationales = null;
    }
  }
  if (!rationales) rationales = fallbackRationales(board, standing, cloneHidden);
  slot.leaderboard.rationales = rationales;
}
```

Then in `buildLeaderboardSlot` itself, attach the runtime-only context so `runSlot` can read board/standing/cloneHidden without re-deriving. Replace the entire `return { ... };` at the end of `buildLeaderboardSlot` (currently lines ~538–562) with:

```js
return {
  id: 'leaderboard',
  persona: board.persona,
  promptKey: 'leaderboard',
  userPayload: `${ctx}\n\n---\n${baseUserPayload}`,
  imageData: null,
  docText: null,
  docFilename: null,
  attachedAsset: null,
  leaderboardContext: { board, standing, cloneHidden },
  leaderboard: {
    boardId: board.id,
    title: board.title,
    persona: board.persona,
    cloneHidden,
    userRank: standing.userRank,
    previousUserRank: prevRank,
    entries: standing.entries.map((e) => ({
      rank: e.rank,
      name: e.name,
      handle: e.handle,
      avatarSrc: e.avatarSrc,
      avatarInitials: e.avatarInitials,
      score: e.score,
      isUser: e.isUser,
    })),
  },
};
```

`leaderboardContext` is a runtime-only field on the slot — it is never persisted because only `slot.leaderboard` is copied onto the post via the `if (slot.leaderboard) post.leaderboard = slot.leaderboard;` line in `runSlot`. The slot object itself goes out of scope after `runSlot` returns.

- [ ] **Step 6: Verify end-to-end by regenerating a post**

In one terminal: `npm run servers`. Wait for both ports to bind.

In another:

```bash
curl -X POST http://localhost:3010/api/posts/generate
```

Then inspect the most recent leaderboard post in `posts/brikeld-hoxha.json` (or whoever the active profile is):

```bash
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('posts/brikeld-hoxha.json','utf8')); const lb=p.find(x=>x.leaderboard); console.log(JSON.stringify(lb.leaderboard, null, 2));"
```

Expected: the object contains `persona`, `cloneHidden` (array of 4 booleans), and `rationales` (array of 5 `{rank, phrase, signal}` objects). If LM Studio is down, `rationales` should still be present (template fallback).

- [ ] **Step 7: Commit**

```bash
git add server/lib/personaPostGenerator.js server/lib/leaderboardRationales.js tests/leaderboardRationales.test.js
git commit -m "feat(leaderboards): generate per-entry rationales with LLM + template fallback"
```

---

## Task 5: Add `leaderboard-self` hide reducer functions + tests

**Files:**
- Modify: `src/features/liveScoring/scoringLogic.js`
- Test: `tests/liveScoringLeaderboardHide.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/liveScoringLeaderboardHide.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  applyLeaderboardSelfHide,
  applyLeaderboardSelfReveal,
  isLeaderboardSelfHidden,
  leaderboardSelfKey,
  computeLiveAdjustments,
} from '../src/features/liveScoring/scoringLogic.js';

describe('leaderboardSelfKey', () => {
  it('is stable per boardId', () => {
    expect(leaderboardSelfKey('most_productive')).toBe('leaderboard-self|most_productive');
  });

  it('cannot collide with a numeric postKey', () => {
    expect(leaderboardSelfKey('most_productive')).not.toMatch(/^\d+$/);
  });
});

describe('applyLeaderboardSelfHide', () => {
  it('adds a record keyed by leaderboardSelfKey', () => {
    const records = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 2);
    expect(records['leaderboard-self|most_secure']).toBeDefined();
    expect(records['leaderboard-self|most_secure'].delta).toBe(-2);
    expect(records['leaderboard-self|most_secure'].persona).toBe('securite');
  });

  it('is a no-op if already hidden', () => {
    const r1 = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 2);
    const r2 = applyLeaderboardSelfHide(r1, 'most_secure', 'securite', 2);
    expect(r2).toBe(r1);
  });
});

describe('applyLeaderboardSelfReveal', () => {
  it('restores 50% to the persona axis (matches applyReveal semantics)', () => {
    const hidden = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 4);
    const adjBefore = computeLiveAdjustments(hidden);
    expect(adjBefore.security).toBe(-4);
    const revealed = applyLeaderboardSelfReveal(hidden, 'most_secure');
    const adjAfter = computeLiveAdjustments(revealed);
    expect(adjAfter.security).toBe(-2); // -4 + 2 (50% restorable)
  });

  it('is a no-op if not currently hidden', () => {
    const r1 = {};
    const r2 = applyLeaderboardSelfReveal(r1, 'most_secure');
    expect(r2).toBe(r1);
  });
});

describe('isLeaderboardSelfHidden', () => {
  it('returns true while the record has restorable points', () => {
    const hidden = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 4);
    expect(isLeaderboardSelfHidden(hidden, 'most_secure')).toBe(true);
  });

  it('returns false after reveal', () => {
    const hidden = applyLeaderboardSelfHide({}, 'most_secure', 'securite', 4);
    const revealed = applyLeaderboardSelfReveal(hidden, 'most_secure');
    expect(isLeaderboardSelfHidden(revealed, 'most_secure')).toBe(false);
  });
});

describe('computeLiveAdjustments interop', () => {
  it('aggregates leaderboard-self records into the same triplet as post hides', () => {
    let records = {};
    records = applyLeaderboardSelfHide(records, 'most_productive', 'productivite', 3);
    records['1234567890'] = { persona: 'popularite', delta: -2, restorable: 1 }; // simulate post hide
    const adj = computeLiveAdjustments(records);
    expect(adj.productivity).toBe(-3);
    expect(adj.social).toBe(-2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/liveScoringLeaderboardHide.test.js`
Expected: FAIL — imports `applyLeaderboardSelfHide` / `applyLeaderboardSelfReveal` / `isLeaderboardSelfHidden` / `leaderboardSelfKey` don't exist.

- [ ] **Step 3: Add the new helpers to `src/features/liveScoring/scoringLogic.js`**

Append below `applyCommentBoost` (around line 130):

```js
/**
 * Record key for a self-hidden row on a leaderboard post. The 'leaderboard-self|'
 * prefix guarantees no collision with `normalizePostHideKey` output (a numeric
 * epoch string).
 */
export function leaderboardSelfKey(boardId) {
  return `leaderboard-self|${boardId}`;
}

/**
 * Hides the user's row on a single leaderboard. Reuses the record shape from
 * applyHide so computeLiveAdjustments treats it identically (debit then 50%
 * restorable on reveal).
 */
export function applyLeaderboardSelfHide(records, boardId, persona, systemDeltaPct) {
  const key = leaderboardSelfKey(boardId);
  if (records[key] && (records[key].restorable ?? 0) > 0) return records;
  return {
    ...records,
    [key]: {
      persona: String(persona).toLowerCase(),
      delta: -Math.abs(systemDeltaPct),
      restorable: Math.abs(systemDeltaPct) * 0.5,
      source: 'leaderboard-self',
    },
  };
}

export function applyLeaderboardSelfReveal(records, boardId) {
  const key = leaderboardSelfKey(boardId);
  const rec = records[key];
  if (!rec) return records;
  const restored = rec.restorable ?? 0;
  if (restored === 0) {
    const next = { ...records };
    delete next[key];
    return next;
  }
  return {
    ...records,
    [key]: { ...rec, delta: rec.delta + restored, restorable: 0 },
  };
}

export function isLeaderboardSelfHidden(records, boardId) {
  const rec = records[leaderboardSelfKey(boardId)];
  return rec != null && (rec.restorable ?? 0) > 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/liveScoringLeaderboardHide.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/liveScoring/scoringLogic.js tests/liveScoringLeaderboardHide.test.js
git commit -m "feat(liveScoring): add applyLeaderboardSelfHide/Reveal + isLeaderboardSelfHidden"
```

---

## Task 6: Expose leaderboard-self actions on `LiveScoringContext`

**Files:**
- Modify: `src/features/liveScoring/LiveScoringContext.jsx`

No unit test — this is a thin context wrapper around the reducer functions tested in Task 5. End-to-end behavior is verified in Task 8 via the running app.

- [ ] **Step 1: Import the new helpers**

In `src/features/liveScoring/LiveScoringContext.jsx`, extend the existing import block (around line 5):

```js
import {
  computeLiveAdjustments,
  computeAdjustedScores,
  applyHide,
  applyReveal,
  applyCommentBoost,
  applyLeaderboardSelfHide,
  applyLeaderboardSelfReveal,
  isPostHidden,
  isLeaderboardSelfHidden,
  dominantPersonaFromAdjustedScores,
} from './scoringLogic.js';
```

- [ ] **Step 2: Add two new reducer cases**

Inside `scoringReducer` (around line 43), add before the `default` branch:

```js
    case 'HIDE_LEADERBOARD_SELF': {
      const newRecords = applyLeaderboardSelfHide(
        state.records,
        action.boardId,
        action.persona,
        action.systemDeltaPct,
      );
      if (newRecords === state.records) return state;
      return { ...state, records: newRecords };
    }
    case 'REVEAL_LEADERBOARD_SELF': {
      const newRecords = applyLeaderboardSelfReveal(state.records, action.boardId);
      if (newRecords === state.records) return state;
      return { ...state, records: newRecords };
    }
```

- [ ] **Step 3: Add the callbacks**

After the existing `revealPost` callback (around line 245), add:

```js
  const hideLeaderboardSelf = useCallback(
    (post, sourcePillRect) => {
      const boardId = post?.leaderboard?.boardId;
      if (!boardId || isLeaderboardSelfHidden(state.records, boardId)) return;
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'hide',
        persona: String(post.leaderboard.persona ?? post.persona ?? '').toLowerCase(),
        sourcePillRect,
        onCommit: () => {
          dispatch({
            type: 'HIDE_LEADERBOARD_SELF',
            boardId,
            persona: post.leaderboard.persona ?? post.persona,
            systemDeltaPct: post.systemDeltaPct ?? 1,
          });
        },
      });
    },
    [state.records, pushAnimationEvent],
  );

  const revealLeaderboardSelf = useCallback(
    (post, sourcePillRect) => {
      const boardId = post?.leaderboard?.boardId;
      if (!boardId || !isLeaderboardSelfHidden(state.records, boardId)) return;
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'reveal',
        persona: String(post.leaderboard.persona ?? post.persona ?? '').toLowerCase(),
        sourcePillRect,
        onCommit: () => {
          dispatch({ type: 'REVEAL_LEADERBOARD_SELF', boardId });
        },
      });
    },
    [state.records, pushAnimationEvent],
  );

  const isLeaderboardSelfHiddenForBoard = useCallback(
    (boardId) => isLeaderboardSelfHidden(state.records, boardId),
    [state.records],
  );
```

- [ ] **Step 4: Add them to the context value**

In the `value = useMemo(() => ({ ... }), [...])` block (around line 257), add the new entries to both the object and the deps array:

```js
  const value = useMemo(
    () => ({
      adjustedScores,
      adjustedScoresRef,
      ringScores,
      animatingRing,
      dominantPersona,
      hidePost,
      revealPost,
      hideLeaderboardSelf,
      revealLeaderboardSelf,
      isLeaderboardSelfHidden: isLeaderboardSelfHiddenForBoard,
      boostFromComment,
      isHidden,
      subscribeAnimations,
      dequeueAnimation,
      beginRingAnimation,
      finishRingAnimation,
    }),
    [
      adjustedScores,
      ringScores,
      animatingRing,
      dominantPersona,
      hidePost,
      revealPost,
      hideLeaderboardSelf,
      revealLeaderboardSelf,
      isLeaderboardSelfHiddenForBoard,
      boostFromComment,
      isHidden,
      subscribeAnimations,
      dequeueAnimation,
      beginRingAnimation,
      finishRingAnimation,
    ],
  );
```

- [ ] **Step 5: Commit**

```bash
git add src/features/liveScoring/LiveScoringContext.jsx
git commit -m "feat(liveScoring): expose hide/reveal/isHidden for leaderboard-self on context"
```

---

## Task 7: Plumb `cloneHidden`, `rationales`, and `leaderboard.persona` through `PostsTab`

**Files:**
- Modify: `src/features/feed/PostsTab.jsx`

Today the mapper just does `leaderboard: (p.leaderboard && Array.isArray(p.leaderboard.entries)) ? p.leaderboard : null` — but it passes the raw object through, which already contains the new fields once the server writes them. Confirm and slightly tighten the guard.

- [ ] **Step 1: Replace the `leaderboard:` line in the mapper (around line 120)**

Change:

```js
leaderboard: (p.leaderboard && Array.isArray(p.leaderboard.entries)) ? p.leaderboard : null,
```

to:

```js
leaderboard: (p.leaderboard && Array.isArray(p.leaderboard.entries)) ? {
  boardId: p.leaderboard.boardId,
  title: p.leaderboard.title,
  persona: p.leaderboard.persona ?? p.persona,
  userRank: p.leaderboard.userRank,
  previousUserRank: p.leaderboard.previousUserRank ?? null,
  entries: p.leaderboard.entries,
  cloneHidden: Array.isArray(p.leaderboard.cloneHidden) ? p.leaderboard.cloneHidden : [false, false, false, false],
  rationales: Array.isArray(p.leaderboard.rationales) ? p.leaderboard.rationales : null,
} : null,
```

The fallback `cloneHidden` (all false) keeps old persisted leaderboard posts (written before Task 2) renderable without crashing.

- [ ] **Step 2: Commit**

```bash
git add src/features/feed/PostsTab.jsx
git commit -m "feat(feed): plumb cloneHidden, rationales, persona through leaderboard mapper"
```

---

## Task 8: `LeaderboardBlock` — CSS restyle + hidden-row variant

**Files:**
- Modify: `src/features/feed/leaderboardBlock.css`
- Modify: `src/features/feed/LeaderboardBlock.jsx`

- [ ] **Step 1: Rewrite the CSS**

Replace the contents of `src/features/feed/leaderboardBlock.css` with:

```css
.leaderboard-block {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px 32px;
  border-radius: 0 0 var(--radius-post-surface) var(--radius-post-surface);
  background: var(--post-accent);
  color: var(--ink);
}

.leaderboard-block__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.leaderboard-block__title {
  font-family: var(--font-avant);
  font-weight: 700;
  font-size: 18px;
  line-height: 1.25;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink);
  margin: 0;
}

.leaderboard-delta {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.55);
  color: var(--ink);
  white-space: nowrap;
}
.leaderboard-delta--new,
.leaderboard-delta--up { background: var(--ink); color: #fff; }
.leaderboard-delta--down { background: rgba(255, 255, 255, 0.55); opacity: 0.85; }

.leaderboard-block__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.leaderboard-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-avant);
}

.leaderboard-row__header {
  display: grid;
  grid-template-columns: 32px 28px 1fr auto;
  align-items: center;
  gap: 10px;
}

.leaderboard-row__rank {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  opacity: 0.55;
}

.leaderboard-row__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.leaderboard-row__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.leaderboard-row__avatar-initials {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 700;
  color: var(--ink);
}

.leaderboard-row__name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--ink);
}

.leaderboard-row__handle {
  font-family: var(--font-avant-book-oblique);
  font-size: 11px;
  color: var(--ink);
  opacity: 0.55;
  line-height: 1.2;
}

.leaderboard-row__bar-track {
  height: 14px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.leaderboard-row__bar-fill {
  height: 100%;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.55);
}

.leaderboard-row--self .leaderboard-row__bar-fill {
  background: var(--ink);
}

.leaderboard-row--self .leaderboard-row__name {
  font-weight: 700;
}

/* Hidden-row variant — applies to self-hidden user OR seeded-hidden clones. */
.leaderboard-row--hidden .leaderboard-row__name {
  font-weight: 500;
  opacity: 0.55;
  font-style: italic;
}
.leaderboard-row--hidden .leaderboard-row__handle {
  display: none;
}
.leaderboard-row--hidden .leaderboard-row__avatar {
  background: rgba(0, 0, 0, 0.18);
}
.leaderboard-row--hidden .leaderboard-row__avatar-img,
.leaderboard-row--hidden .leaderboard-row__avatar-initials {
  display: none;
}
.leaderboard-row--hidden .leaderboard-row__bar-fill {
  background: rgba(0, 0, 0, 0.25);
}
```

- [ ] **Step 2: Update `LeaderboardBlock.jsx` to honor hidden state**

Replace the contents of `src/features/feed/LeaderboardBlock.jsx` with:

```jsx
import { useId } from 'react';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import './leaderboardBlock.css';

function DeltaChip({ userRank, previousUserRank }) {
  if (previousUserRank == null) {
    return <span className="leaderboard-delta leaderboard-delta--new">NEW</span>;
  }
  if (previousUserRank === userRank) return null;
  const isUp = userRank < previousUserRank;
  return (
    <span
      className={`leaderboard-delta ${isUp ? 'leaderboard-delta--up' : 'leaderboard-delta--down'}`}
    >
      {isUp ? '▲' : '▼'} from #{previousUserRank}
    </span>
  );
}

function Row({ entry, hidden }) {
  const cls = [
    'leaderboard-row',
    entry.isUser ? 'leaderboard-row--self' : '',
    hidden ? 'leaderboard-row--hidden' : '',
  ].filter(Boolean).join(' ');
  // Assumes 5-entry board: rank 1 → 100%, rank 5 → 20%.
  const widthPct = ((6 - entry.rank) / 5) * 100;
  const name = hidden ? 'position hidden' : entry.name;
  return (
    <li className={cls}>
      <div className="leaderboard-row__header">
        <span className="leaderboard-row__rank">{String(entry.rank).padStart(2, '0')}</span>
        <span className="leaderboard-row__avatar" aria-hidden>
          {!hidden && entry.avatarSrc
            ? <img className="leaderboard-row__avatar-img" src={entry.avatarSrc} alt="" />
            : !hidden
              ? <span className="leaderboard-row__avatar-initials">{entry.avatarInitials}</span>
              : null}
        </span>
        <span className="leaderboard-row__name">{name}</span>
        {!hidden && entry.handle
          ? <span className="leaderboard-row__handle">{entry.handle}</span>
          : null}
      </div>
      <div className="leaderboard-row__bar-track">
        <div className="leaderboard-row__bar-fill" style={{ width: `${widthPct}%` }} />
      </div>
    </li>
  );
}

export default function LeaderboardBlock({ leaderboard, accentColor }) {
  if (!leaderboard || !Array.isArray(leaderboard.entries)) return null;
  const {
    title,
    entries,
    userRank,
    previousUserRank,
    boardId,
    cloneHidden = [false, false, false, false],
  } = leaderboard;
  const { isLeaderboardSelfHidden } = useLiveScoring();
  const selfHidden = isLeaderboardSelfHidden(boardId);
  const reactId = useId();
  const titleId = `leaderboard-title-${boardId}-${reactId}`;

  // Map each entry to its "is this row hidden?" flag.
  // The user row is hidden when isLeaderboardSelfHidden(boardId) is true.
  // Clone rows index cloneHidden[] by their position among the 4 clones (in rank order).
  let cloneIdx = -1;
  const hiddenForEntry = entries.map((e) => {
    if (e.isUser) return selfHidden;
    cloneIdx += 1;
    return Boolean(cloneHidden[cloneIdx]);
  });

  return (
    <div
      className="leaderboard-block"
      style={{ '--post-accent': accentColor }}
    >
      <header className="leaderboard-block__head">
        <h3 id={titleId} className="leaderboard-block__title">{title}</h3>
        <DeltaChip userRank={userRank} previousUserRank={previousUserRank} />
      </header>
      <ul
        className="leaderboard-block__rows"
        aria-labelledby={titleId}
      >
        {entries.map((e, i) => (
          <Row key={e.rank} entry={e} hidden={hiddenForEntry[i]} />
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Verify in the browser**

`npm run servers` + `npm run dev`. Open the app, navigate to a leaderboard post (home feed). Confirm visually:
- No black stroke around the block.
- Top corners square (continuous with the post-card bubble above), bottom corners rounded.
- Title font matches `.post-lead` size (~18px), not the old uppercase mono.
- Seeded-hidden clone rows (1 in 4, deterministic) render with "position hidden" text and muted bar.
- The block background color matches the post's persona (productivity/security/popularity).

- [ ] **Step 4: Commit**

```bash
git add src/features/feed/LeaderboardBlock.jsx src/features/feed/leaderboardBlock.css
git commit -m "feat(feed): restyle leaderboard block + render hidden-row variant"
```

---

## Task 9: Branch hide flow in `App.jsx` for leaderboard posts

**Files:**
- Modify: `src/app/App.jsx`

- [ ] **Step 1: Update the destructured context hook**

Find the `useLiveScoring()` destructure (around line 201):

```js
const { adjustedScores, dominantPersona: liveDominantPersona, hidePost, revealPost, isHidden } =
```

Replace with:

```js
const {
  adjustedScores,
  dominantPersona: liveDominantPersona,
  hidePost,
  revealPost,
  hideLeaderboardSelf,
  revealLeaderboardSelf,
  isLeaderboardSelfHidden,
  isHidden,
} =
```

- [ ] **Step 2: Update the "is the highlighted post currently hidden" derivation**

Find `highlightedPostIsHidden` (around line 250):

```js
const highlightedPostIsHidden = highlightedPost
  ? isHidden(normalizePostHideKey(highlightedPost.createdAt))
  : false;
```

Replace with:

```js
const highlightedPostIsHidden = highlightedPost
  ? (highlightedPost.leaderboard
      ? isLeaderboardSelfHidden(highlightedPost.leaderboard.boardId)
      : isHidden(normalizePostHideKey(highlightedPost.createdAt)))
  : false;
```

- [ ] **Step 3: Branch `handleDashboardHide` (around line 264)**

Replace:

```js
const handleDashboardHide = () => {
  if (!profile) return;
  if (highlightedPost) {
    if (highlightedPostIsHidden) {
      revealPost(highlightedPost, getHighlightedPostRect());
      setHighlightedPost(null);
      setConfirmingHide(false);
    } else {
      setConfirmingHide(true);
      setHideNudge(false);
    }
  } else {
    setConfirmingHide(false);
    setHideNudge(true);
    setTimeout(() => setHideNudge(false), 4000);
  }
};
```

with:

```js
const handleDashboardHide = () => {
  if (!profile) return;
  if (highlightedPost) {
    const isLeaderboard = Boolean(highlightedPost.leaderboard);
    if (highlightedPostIsHidden) {
      if (isLeaderboard) {
        revealLeaderboardSelf(highlightedPost, getHighlightedPostRect());
      } else {
        revealPost(highlightedPost, getHighlightedPostRect());
      }
      setHighlightedPost(null);
      setConfirmingHide(false);
    } else {
      // Encode "only hide a leaderboard if user is in it" — userRank null means not present.
      if (isLeaderboard && highlightedPost.leaderboard.userRank == null) {
        setConfirmingHide(false);
        return;
      }
      setConfirmingHide(true);
      setHideNudge(false);
    }
  } else {
    setConfirmingHide(false);
    setHideNudge(true);
    setTimeout(() => setHideNudge(false), 4000);
  }
};
```

- [ ] **Step 4: Branch `handleConfirmHide` (around line 282)**

Replace:

```js
const handleConfirmHide = () => {
  if (highlightedPost) {
    hidePost(highlightedPost, getHighlightedPostRect());
  }
  setConfirmingHide(false);
  setHighlightedPost(null);
};
```

with:

```js
const handleConfirmHide = () => {
  if (highlightedPost) {
    if (highlightedPost.leaderboard) {
      hideLeaderboardSelf(highlightedPost, getHighlightedPostRect());
    } else {
      hidePost(highlightedPost, getHighlightedPostRect());
    }
  }
  setConfirmingHide(false);
  setHighlightedPost(null);
};
```

- [ ] **Step 5: Verify in the browser**

With the app running, select a leaderboard post in the home feed, click HIDE, confirm. Expected:
- The post card stays visible (does NOT collapse to the hidden state used for regular posts).
- The user's row in the leaderboard swaps to the "position hidden" placeholder.
- The persona ring matching `leaderboard.persona` decreases by the post's `systemDeltaPct`.
- Clicking HIDE again on the same selected post offers REVEAL (button label flips per existing flow).
- Confirming reveal restores the user's row and restores 50% of the score.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.jsx
git commit -m "feat(app): route leaderboard-post hide flow through leaderboard-self path"
```

---

## Task 10: Inference panel ranking-post variant — `LeaderboardRationaleView`

**Files:**
- Create: `src/features/inferenceChain/LeaderboardRationaleView.jsx`
- Modify: `src/features/inferenceChain/InferenceChainPanel.jsx`
- Modify: `src/features/inferenceChain/inferenceChain.css`

- [ ] **Step 1: Create `LeaderboardRationaleView.jsx`**

```jsx
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';

/**
 * Per-entry rationale view shown inside the inference panel when the post is a
 * leaderboard. Mirrors the LeaderboardBlock's hidden-state logic so the two
 * views stay in sync.
 */
export default function LeaderboardRationaleView({ leaderboard }) {
  if (!leaderboard || !Array.isArray(leaderboard.entries)) return null;
  const {
    entries,
    boardId,
    cloneHidden = [false, false, false, false],
    rationales,
  } = leaderboard;
  const { isLeaderboardSelfHidden } = useLiveScoring();
  const selfHidden = isLeaderboardSelfHidden(boardId);

  let cloneIdx = -1;
  const rows = entries.map((entry) => {
    let hidden;
    if (entry.isUser) {
      hidden = selfHidden;
    } else {
      cloneIdx += 1;
      hidden = Boolean(cloneHidden[cloneIdx]);
    }
    const rationale = Array.isArray(rationales)
      ? rationales.find((r) => r.rank === entry.rank)
      : null;
    return { entry, hidden, rationale };
  });

  return (
    <ol className="leaderboard-rationales" aria-label="Per-entry rationales">
      {rows.map(({ entry, hidden, rationale }) => (
        <li
          key={entry.rank}
          className={`leaderboard-rationale-row${hidden ? ' is-hidden' : ''}${entry.isUser ? ' is-self' : ''}`}
        >
          <div className="leaderboard-rationale-row__head">
            <span className="leaderboard-rationale-row__rank">
              {String(entry.rank).padStart(2, '0')}
            </span>
            <span className="leaderboard-rationale-row__avatar" aria-hidden>
              {!hidden && entry.avatarSrc
                ? <img src={entry.avatarSrc} alt="" />
                : !hidden
                  ? <span className="leaderboard-rationale-row__initials">{entry.avatarInitials}</span>
                  : null}
            </span>
            <span className="leaderboard-rationale-row__name">
              {hidden ? 'position hidden' : entry.name}
            </span>
          </div>
          {hidden ? (
            <p className="leaderboard-rationale-row__hidden">
              no signal shared
            </p>
          ) : (
            <>
              {rationale?.phrase ? (
                <p className="leaderboard-rationale-row__phrase">{rationale.phrase}</p>
              ) : null}
              {rationale?.signal ? (
                <span className="leaderboard-rationale-row__signal">{rationale.signal}</span>
              ) : null}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: Branch in `InferenceChainPanel.jsx`**

In `src/features/inferenceChain/InferenceChainPanel.jsx`, add an import near the top with the existing imports:

```js
import LeaderboardRationaleView from './LeaderboardRationaleView.jsx';
```

Add a constant at the start of the component function (after the destructures around line 56):

```js
const leaderboard = post?.leaderboard ?? null;
const isLeaderboardPost = Boolean(leaderboard && Array.isArray(leaderboard.entries));
```

Replace the body section that conditionally renders the chain/ingredients toggle and the body div (lines ~136–195). Replace:

```jsx
{(validChain && hasIngredients) ? (
  <div className="inference-panel__toggle" role="tablist" aria-label="Analysis view">
    {/* ...toggle buttons... */}
  </div>
) : null}

<div className="inference-panel__body">
  {view === 'chain' && validChain ? (
    <ol className="inference-panel__steps" aria-label="Inference steps">
      {/* ...StepRows... */}
    </ol>
  ) : view === 'ingredients' && hasIngredients ? (
    <IngredientsView ... />
  ) : (
    <div className="inference-panel__empty">
      <p>Analysis not available for this post.</p>
    </div>
  )}
</div>
```

with (preserving the chain/ingredients branch when NOT a leaderboard post):

```jsx
{isLeaderboardPost ? null : ((validChain && hasIngredients) ? (
  <div className="inference-panel__toggle" role="tablist" aria-label="Analysis view">
    <button
      type="button"
      role="tab"
      aria-selected={view === 'ingredients'}
      className={`inference-panel__toggle-btn${view === 'ingredients' ? ' is-active' : ''}`}
      onClick={() => handleSetView('ingredients')}
    >
      Ingredients
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={view === 'chain'}
      className={`inference-panel__toggle-btn${view === 'chain' ? ' is-active' : ''}`}
      onClick={() => handleSetView('chain')}
    >
      Inference Chain
    </button>
  </div>
) : null)}

<div className="inference-panel__body">
  {isLeaderboardPost ? (
    <LeaderboardRationaleView leaderboard={leaderboard} />
  ) : view === 'chain' && validChain ? (
    <ol className="inference-panel__steps" aria-label="Inference steps">
      <StepRow
        step="data"
        value={readableValue(findStep(chain, 'data').value, 'A signal from the user’s machine data')}
        source={readableSource(findStep(chain, 'data').source)}
        showConnector
        pulse={pulseStep.index === 0 ? pulseStep.key : 0}
      />
      <StepRow
        step="classify"
        value={findStep(chain, 'classify').value}
        confidence={findStep(chain, 'classify').confidence ?? 'high'}
        showConnector
        pulse={pulseStep.index === 1 ? pulseStep.key : 0}
      />
      <InferStepRow
        value={findStep(chain, 'infer').value}
        confidence={findStep(chain, 'infer').confidence ?? 'low'}
        isBiased={findStep(chain, 'infer').isBiased === true}
        biasNote={findStep(chain, 'infer').biasNote}
        pulse={pulseStep.index === 2 ? pulseStep.key : 0}
      />
    </ol>
  ) : view === 'ingredients' && hasIngredients ? (
    <IngredientsView
      ingredients={ingredients}
      expandedIndices={expandedIngredients}
      onToggleExpand={handleToggleIngredient}
    />
  ) : (
    <div className="inference-panel__empty">
      <p>Analysis not available for this post.</p>
    </div>
  )}
</div>
```

Also update the kicker text near line 112 to read `"{persona} leaderboard"` when it's a leaderboard post:

Replace:

```jsx
<span className="inference-panel__kicker">
  {personaLabel ? `${personaLabel.toLowerCase()} persona` : 'inference chain'}
</span>
```

with:

```jsx
<span className="inference-panel__kicker">
  {isLeaderboardPost
    ? `${(leaderboard.persona ?? '').toLowerCase()} leaderboard`
    : personaLabel ? `${personaLabel.toLowerCase()} persona` : 'inference chain'}
</span>
```

- [ ] **Step 3: Append the rationale styles to `inferenceChain.css`**

Append at the end of `src/features/inferenceChain/inferenceChain.css`:

```css
.leaderboard-rationales {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.leaderboard-rationale-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.leaderboard-rationale-row:last-child {
  border-bottom: none;
}

.leaderboard-rationale-row__head {
  display: grid;
  grid-template-columns: 28px 24px 1fr;
  align-items: center;
  gap: 10px;
}

.leaderboard-rationale-row__rank {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.55;
}

.leaderboard-rationale-row__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.leaderboard-rationale-row__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.leaderboard-rationale-row__initials {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 700;
}

.leaderboard-rationale-row__name {
  font-family: var(--font-avant);
  font-size: 14px;
  font-weight: 600;
}

.leaderboard-rationale-row.is-self .leaderboard-rationale-row__name {
  font-weight: 700;
}

.leaderboard-rationale-row.is-hidden .leaderboard-rationale-row__name {
  font-style: italic;
  opacity: 0.55;
  font-weight: 500;
}

.leaderboard-rationale-row__phrase {
  font-family: var(--font-avant);
  font-size: 14px;
  margin: 4px 0 0 38px;
  line-height: 1.35;
}

.leaderboard-rationale-row__signal {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
  opacity: 0.65;
  margin: 0 0 0 38px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-pill);
  align-self: flex-start;
}

.leaderboard-rationale-row__hidden {
  font-family: var(--font-avant-book-oblique);
  font-size: 12px;
  opacity: 0.55;
  margin: 4px 0 0 38px;
}
```

- [ ] **Step 4: Verify in the browser**

Select a leaderboard post and open "How the system reached this post". Expected:
- Kicker reads `"productivity leaderboard"` (or whichever persona).
- No chain/ingredients toggle visible.
- 5 rows, ranks 01..05, each with a short phrase + signal pill.
- Seeded-hidden clones render with `"position hidden"` + `"no signal shared"` (no phrase, no signal pill).
- If the user hides their row (Task 9), the user's row in the panel also goes to the hidden state on the next open.

- [ ] **Step 5: Commit**

```bash
git add src/features/inferenceChain/LeaderboardRationaleView.jsx src/features/inferenceChain/InferenceChainPanel.jsx src/features/inferenceChain/inferenceChain.css
git commit -m "feat(inference): leaderboard-post variant renders per-entry rationales"
```

---

## Task 11: Persona-grouped sections on the profile Leaderboards tab

**Files:**
- Modify: `src/features/profile/tabs/LeaderboardsTab.jsx`
- Modify: `src/styles/profile.css` (append styles)

- [ ] **Step 1: Group by persona in `LeaderboardsTab.jsx`**

Replace the contents of `src/features/profile/tabs/LeaderboardsTab.jsx` with:

```jsx
import { useEffect, useMemo, useState } from 'react';

const DEFAULT_GENERATE_API_ORIGIN =
  (import.meta?.env?.VITE_GENERATE_API_ORIGIN && String(import.meta.env.VITE_GENERATE_API_ORIGIN)) ||
  'http://localhost:3010';

const PERSONA_COLORS = {
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

const PERSONA_SECTION_ORDER = ['productivite', 'securite', 'popularite'];

const PERSONA_SECTION_LABEL = {
  productivite: 'PRODUCTIVITY LEADERBOARDS',
  securite: 'SECURITY LEADERBOARDS',
  popularite: 'POPULARITY LEADERBOARDS',
};

function formatScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toString();
}

function LeaderboardCard({ board }) {
  const others = (board.entries || []).filter((entry) => !entry.isUser);

  return (
    <article className="profile-leaderboard-card">
      <header className="profile-leaderboard-card__head">
        <div>
          <p className="profile-leaderboard-card__eyebrow">leaderboards</p>
          <h3 className="profile-leaderboard-card__title">{board.title}</h3>
        </div>
        <span className="profile-leaderboard-card__rank">#{board.userRank}</span>
      </header>

      <ol className="profile-leaderboard-card__rows" aria-label={`${board.title} standings`}>
        {(board.entries || []).map((entry) => (
          <li
            key={`${board.boardId}-${entry.rank}-${entry.handle}-${entry.isUser ? 'self' : 'clone'}`}
            className={`profile-leaderboard-row${entry.isUser ? ' is-self' : ''}`}
          >
            <span className="profile-leaderboard-row__rank">{entry.rank}</span>
            <span className="profile-leaderboard-row__name">{entry.name}</span>
            <span className="profile-leaderboard-row__score">{formatScore(entry.score)}</span>
          </li>
        ))}
      </ol>

      {others.length > 0 && (
        <p className="profile-leaderboard-card__hint">{board.hint}</p>
      )}
    </article>
  );
}

export default function LeaderboardsTab({
  profile,
  generateApiOrigin = DEFAULT_GENERATE_API_ORIGIN,
}) {
  const [leaderboards, setLeaderboards] = useState([]);

  useEffect(() => {
    if (!profile) {
      setLeaderboards([]);
      return undefined;
    }

    const controller = new AbortController();
    async function loadLeaderboards() {
      try {
        const res = await fetch(`${generateApiOrigin}/api/leaderboards`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!controller.signal.aborted) {
          setLeaderboards(Array.isArray(json.leaderboards) ? json.leaderboards : []);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') setLeaderboards([]);
      }
    }

    loadLeaderboards();
    return () => controller.abort();
  }, [generateApiOrigin, profile]);

  const grouped = useMemo(() => {
    const out = { productivite: [], securite: [], popularite: [] };
    for (const b of leaderboards) {
      const key = out[b.persona] ? b.persona : 'productivite';
      out[key].push(b);
    }
    return out;
  }, [leaderboards]);

  return (
    <div className="profile-leaderboards-stack">
      {PERSONA_SECTION_ORDER.map((personaKey) => {
        const boards = grouped[personaKey];
        if (!boards || boards.length === 0) return null;
        return (
          <section
            key={personaKey}
            className={`profile-leaderboards-section profile-leaderboards-section--${personaKey}`}
            style={{ '--persona-accent': PERSONA_COLORS[personaKey] }}
          >
            <h2 className="profile-leaderboards-section__title">
              {PERSONA_SECTION_LABEL[personaKey]}
            </h2>
            <div className="profile-leaderboards-grid">
              {boards.map((board) => (
                <LeaderboardCard key={board.boardId} board={board} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Append section styles to `src/styles/base.css`**

The existing `.profile-leaderboards-grid` + `.profile-leaderboard-card` rules already live in `src/styles/base.css` (around line 2289, under the `/* ── LEADERBOARDS ── */` heading). Append these new rules immediately after the existing `.profile-leaderboard-card` block so the related rules stay co-located:

```css
.profile-leaderboards-stack {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.profile-leaderboards-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-leaderboards-section__title {
  font-family: var(--font-avant);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.08em;
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--persona-accent);
  color: var(--ink);
}
```

The pre-existing `.profile-leaderboards-grid` rule (already in `base.css`) handles the per-section card grid layout, unchanged.

- [ ] **Step 3: Verify in the browser**

Open the Profile tab → Leaderboards. Expected:
- Three sections stacked vertically: PRODUCTIVITY LEADERBOARDS (4 cards), SECURITY LEADERBOARDS (1 card), POPULARITY LEADERBOARDS (2 cards).
- Each section title is underlined in the matching persona color.
- Each section's cards keep their existing layout.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/tabs/LeaderboardsTab.jsx src/styles/base.css
git commit -m "feat(profile): group leaderboards tab by persona with section titles"
```

---

## Task 12: Full-feature manual verification

**Files:**
- None (this is a verification task — no code changes)

This task confirms the integrated behavior end-to-end after every prior task lands.

- [ ] **Step 1: Run both servers + the dev app**

Three terminals:
```bash
npm run servers
npm run dev
```
Open the URL Vite prints (default `http://localhost:5173`).

- [ ] **Step 2: Force generation of multiple leaderboard posts so persona variety appears**

Hit `POST /api/posts/generate` until at least 2 of the 3 personas have a leaderboard post:

```bash
for i in 1 2 3 4 5; do curl -X POST http://localhost:3010/api/posts/generate; done
```

Inspect:
```bash
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('posts/brikeld-hoxha.json','utf8')); p.filter(x=>x.leaderboard).forEach(x=>console.log(x.persona, x.leaderboard.boardId));"
```

- [ ] **Step 3: Verify each requirement from the spec checklist**

In the running app:

1. **Persona color flow:** at least one non-productivity leaderboard post is rendered with its persona's background color (security blue or popularity yellow-green).
2. **No black stroke / square top corners:** the leaderboard block reads as a continuation of the post card.
3. **Title size:** the leaderboard title font roughly matches the post body text size.
4. **Seeded-hidden clones:** at least one row per leaderboard post shows `position hidden` (the seeded ~1-in-4 mask should hit).
5. **Hide my row:** select a leaderboard post → HIDE → confirm. The post stays visible, only your row swaps to "position hidden", and the persona ring drops by `systemDeltaPct` matching the post's persona.
6. **Reveal my row:** select the same post → HIDE button now reads REVEAL (per existing flow). Confirm → row restored, score restores 50%.
7. **Inference panel:** click "How the system reached this post" on a leaderboard post → kicker reads `"{persona} leaderboard"`, body shows 5 rationale rows, hidden rows show `no signal shared`, no chain/ingredients toggle.
8. **Profile tab grouping:** Profile → Leaderboards shows 3 persona-titled sections.

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```
Expected: PASS (all existing tests still pass; new tests from Tasks 1, 4, 5 pass).

- [ ] **Step 5: Commit nothing (this is verification only)**

No commit. If any check fails, fix the failing area and amend with a follow-up commit referencing the failing step.

---

## Out of scope reminders (do NOT add as tasks)

These are explicitly out of scope per the spec §7:
- Persona rotation in `pickBoardToPost` (the all-productivity feed in fresh data is a data artifact, not a system bug — Task 12 forces variety via repeated generation).
- Animations for the hidden-row transition (instant swap is fine).
- Multi-viewer semantics.
- A "regenerate rationales" button on the panel.

If you encounter pressure to add them mid-implementation, stop and re-confirm with the spec author.
