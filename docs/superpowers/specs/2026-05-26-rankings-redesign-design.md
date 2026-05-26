# Rankings Redesign — Design

**Date:** 2026-05-26
**Status:** Draft, pending implementation plan
**Scope:** Promote leaderboard posts to first-class behavior. Change the hide flow so users hide only their position (not the whole post); restyle the block so it visually integrates with the post card; persona-color each ranking correctly; add per-entry LLM rationales surfaced in the inference-chain panel; group the profile-tab leaderboards by persona.

Builds on [2026-05-25-leaderboard-post-design.md](2026-05-25-leaderboard-post-design.md) (data model) and [2026-05-26-leaderboard-visual-design.md](2026-05-26-leaderboard-visual-design.md) (initial bar visual). This spec supersedes the visual decisions where they conflict.

## 1. Goal

A ranking post is not a regular post: it visualizes the user *and* four other entities, it is the only post type with an internal "who else is here" structure, and its inference-chain story is per-entry rather than a single signal chain. Today it borrows the regular post chrome and the regular hide semantics; both are wrong for what the ranking is showing.

This design treats the ranking post as its own variant: a different hide affordance, a different inference panel body, a per-entry data shape that survives LLM regeneration, and a profile-tab layout grouped by persona.

## 2. Behavior changes

### 2.1 Hide affordance

The dashboard HIDE button, when the highlighted post has a `leaderboard`, hides **only the user's row** in that ranking — never the whole post. The post card itself stays visible in the feed.

- Hide button is enabled only if `post.leaderboard.userRank != null`. Today this is always true; the rule is recorded so a future "user not in this board" post variant naturally falls back to no-hide.
- Confirming hide:
  - Replaces the user's row in `LeaderboardBlock` with a `"position hidden"` placeholder at the same rank slot (avatar → anonymous glyph, name → `position hidden`, handle removed, bar muted).
  - Applies the same `-systemDeltaPct` debit to the board's persona that a regular post hide would (existing `applyHide` reducer path). The board's persona is `post.persona` for ranking posts.
- Reveal: the dashboard REVEAL button, when the user's row is currently hidden on this ranking, restores it. Score credit follows the existing `applyReveal` path.

### 2.2 Inference-chain panel for ranking posts

When the user opens "How the system reached this post" on a ranking post, the panel shows a **per-entry rationale view** instead of the ingredients/chain toggle:

- The header keeps the same title; kicker becomes `"{persona} leaderboard"` (lower-cased to match existing style).
- The post-text highlights row still renders.
- The panel body lists 5 rows, one per ranking entry, in rank order:
  - rank · avatar · name · short LLM phrase · raw-data signal
  - For the user (if not self-hidden): the LLM phrase is informed by the real `board.hint`; the signal is the actual hint string from `server/lib/leaderboards.js`.
  - For each clone: the LLM phrase reads as personality only; the signal is constrained to `"score N · yours M"` — no fabricated app counts.
  - For any **hidden** row (user-self or seeded clone): the row reads `position hidden — no signal shared`. No LLM phrase, no signal.
- No tab toggle, no chain steps, no ingredients view for ranking posts.

### 2.3 Per-clone hidden state

Each board independently seeds which clones have their position hidden, so the demo carries the same "some users have hidden themselves" texture as the user's own hide action.

- `cloneHidden[i] = seededFloat("hidden|" + boardId + "|" + i) > 0.75` — roughly 1 in 4 clones hidden per board, stable across reloads, varies between boards.
- A hidden clone renders identically to a hidden user row (placeholder text, muted bar, no rationale).
- Hidden state lives in the persisted `post.leaderboard.cloneHidden[]` array, computed once at post creation. Recomputing on every render would re-seed against changing input.

## 3. Data model

### 3.1 Server-stored post shape ([personaPostGenerator.js](server/lib/personaPostGenerator.js), [leaderboards.js](server/lib/leaderboards.js))

```jsonc
{
  "persona": "productivite",
  "content": "...",
  "leaderboard": {
    "boardId": "most_productive",
    "title": "Top 5 Most Productive",
    "persona": "productivite",          // NEW: explicit on the leaderboard object
    "userRank": 3,
    "previousUserRank": 5,
    "entries": [ /* unchanged: 5 entries */ ],
    "cloneHidden": [false, true, false, false],   // NEW: aligned with the 4 clones
    "rationales": [                                // NEW: aligned with entries[]
      { "rank": 1, "phrase": "shipping at 2am, every night", "signal": "score 61 · yours 47" },
      { "rank": 2, "phrase": "...", "signal": "..." },
      // 5 rows total — one per rank
      { "rank": 5, "phrase": "...", "signal": "..." }
    ]
  }
}
```

Rationale objects for hidden rows still appear (so indexing stays simple) but their `phrase` is `null` and `signal` is `null`. The client treats `null` as "render the position-hidden placeholder."

### 3.2 Client-side hide record ([LiveScoringContext.jsx](src/features/liveScoring/LiveScoringContext.jsx), [scoringLogic.js](src/features/liveScoring/scoringLogic.js))

Today `state.records[postKey]` holds a per-post hide. We add a second record kind keyed by `leaderboard-self|{boardId}`:

```js
{
  // existing whole-post hide:
  "<postKey>": { kind: 'post', persona, debit },
  // NEW ranking-row hide:
  "leaderboard-self|most_productive": { kind: 'leaderboard-self', boardId, persona, debit }
}
```

Both record kinds feed the same `computeLiveAdjustments` aggregator, so the persona ring math is unchanged. The reducer gains `HIDE_LEADERBOARD_SELF` and `REVEAL_LEADERBOARD_SELF` action types that mirror the existing `HIDE` / `REVEAL` paths. Selectors `isLeaderboardSelfHidden(boardId)` and `hideLeaderboardSelf(post)` / `revealLeaderboardSelf(post)` are exposed on the context.

The chosen key shape (`leaderboard-self|<boardId>`) cannot collide with `normalizePostHideKey` output (which is a numeric epoch string), so the same `records` map is safe for both.

## 4. Visual changes

### 4.1 `LeaderboardBlock` ([LeaderboardBlock.jsx](src/features/feed/LeaderboardBlock.jsx), [leaderboardBlock.css](src/features/feed/leaderboardBlock.css))

- **Remove** the outer `border: ... solid var(--border)` (no black stroke).
- **Top corners square** so the block reads as a continuation of the post-card bubble:
  - `border-radius: 0 0 var(--radius-post-surface) var(--radius-post-surface)`
- **Title** uses `var(--font-avant)` at the same size as `.post-lead` (the post-card body text). The mono-uppercase styling is dropped; the title reads as a heading, not a tag.
- **Block padding** increases to `28px 32px`. Row gap `12px` → `16px`. Bar height `10px` → `14px`.
- **`.leaderboard-row--hidden`** new modifier:
  - name slot text: `position hidden`
  - avatar slot: neutral disc, no initials or image
  - handle hidden
  - bar fill color: `rgba(0, 0, 0, 0.25)` regardless of `--self`
- The component reads `cloneHidden[i]` and `isLeaderboardSelfHidden(boardId)` to decide which rows render hidden. The user's row uses the live selector (so toggling reveal updates immediately); clone hidden state comes off the persisted post data.

### 4.2 Persona coloring

`PostsTab.jsx` already sets `noteColor = PERSONA_COLORS[p.persona]`, and the leaderboard slot already writes `post.persona = board.persona`. **No code change is needed** to make non-productivity boards render with their persona color — the today-all-grey effect is a data artifact (every persisted leaderboard post happens to be a productivity board pick). Explicitly noting this so we don't go chasing a phantom CSS bug.

Out of scope: forcing persona rotation in `pickBoardToPost`. Flagged in §7.

### 4.3 Inference panel ranking-post variant ([InferenceChainPanel.jsx](src/features/inferenceChain/InferenceChainPanel.jsx))

Split the panel body on `Boolean(post.leaderboard)`:

- New `LeaderboardRationaleView` component, sibling to the existing `IngredientsView`.
- Receives `entries`, `rationales`, `cloneHidden`, `userRank`, `isUserHidden`.
- Renders the 5 rationale rows described in §2.2.
- The chain/ingredients toggle, `StepRow` / `InferStepRow` / `IngredientsView` paths are skipped entirely when a leaderboard is present (even if the post happens to also have `inferenceChain` / `ingredients` populated — for a ranking post those are noise).

### 4.4 Profile-tab grouping ([LeaderboardsTab.jsx](src/features/profile/tabs/LeaderboardsTab.jsx))

Group `/api/leaderboards` results by `persona`. Render three sections in fixed order `productivite → securite → popularite`:

```
PRODUCTIVITY LEADERBOARDS                  (persona accent)
[ board card ] [ board card ] [ board card ] [ board card ]

SECURITY LEADERBOARDS
[ board card ]

POPULARITY LEADERBOARDS
[ board card ] [ board card ]
```

Each section sets `style={{ '--persona-accent': PERSONA_COLORS[persona] }}` on its wrapper so the existing `LeaderboardCard` styling reads the right accent per section without touching the card component itself.

Section header style: same family as the post-card byline name (`var(--font-avant)`, large), persona-colored, uppercase, with a thin underline rule matching the persona accent. Sections separated by `32px` vertical space.

## 5. LLM rationale generation

### 5.1 New prompt key ([prompts.js](server/lib/prompts.js))

Add a `leaderboard_rationales` entry:

```js
leaderboard_rationales: {
  system: `You write very short rationales for a satirical surveillance leaderboard. You will be given a board title, the board's scoring rule in plain English, and 5 entries with rank + score. ONE of the entries is marked "isUser:true" — for that entry only, use the provided real signal hint. For all other entries (clones) you may invent a short personality line, BUT the "signal" field for clones must ONLY restate "score N · yours M" — never invent app counts, file counts, or other fabricated data. Phrases are lower-case, max 90 chars, no hashtags, no emojis. Return ONLY valid JSON: {"rationales":[{"rank":1,"phrase":"...","signal":"..."}, ...]} with exactly 5 entries, one per rank, in rank order. /no_think`,
  temperature: 0.6,
  maxTokens: 600,
}
```

### 5.2 Generator wiring ([personaPostGenerator.js](server/lib/personaPostGenerator.js))

In `buildLeaderboardSlot`, after the standing is computed:

1. Compute `cloneHidden[]` deterministically (§2.3). Hidden clones still get a rationale slot but the LLM is told `"hidden:true"` for them and instructed to emit `phrase:null, signal:null`.
2. Build the rationales prompt payload (board title, hint template, 5 entries with rank/score/isUser/hidden, user's actual hint values).
3. Make a second LM Studio call with the `leaderboard_rationales` prompt.
4. Parse JSON. Validate: array length 5, ranks 1–5 unique, each `phrase` either `null` or string ≤ 90 chars, each `signal` either `null` or string.
5. On any failure, fall back to a deterministic template table:

```js
RATIONALE_TEMPLATES['most_productive'] = {
  selfPhrase: 'shipping more than you sleep',
  clonePhrases: ['quietly outproducing the room', 'mostly creative tools today', 'late-night work bursts', 'one big push, then silence'],
};
```

One template set per board. The fallback path emits the same `{rank, phrase, signal}` shape so the renderer is identical.

The rationales payload is persisted on the post regardless of which path produced it — the client never re-fetches.

### 5.3 Cost

One extra LM Studio call per leaderboard post generated (~one per generation cycle when a board's user-rank actually changes). Same model, ~600 tokens out. Acceptable given the existing 4-slot pipeline already makes 3–4 calls.

## 6. Files touched

| File | Change |
| --- | --- |
| `server/lib/leaderboards.js` | Add `cloneHiddenForBoard(boardId)` helper; surface `persona` on standings (already present, double-check). |
| `server/lib/personaPostGenerator.js` | Second LM call in `buildLeaderboardSlot`; persist `rationales[]` + `cloneHidden[]` + `persona` on `post.leaderboard`. |
| `server/lib/prompts.js` | New `leaderboard_rationales` prompt + per-board `RATIONALE_TEMPLATES` fallback table. |
| `src/features/liveScoring/scoringLogic.js` | New record kind + reducer helpers `applyLeaderboardSelfHide` / `applyLeaderboardSelfReveal` / `isLeaderboardSelfHidden`. |
| `src/features/liveScoring/LiveScoringContext.jsx` | Expose `hideLeaderboardSelf` / `revealLeaderboardSelf` / `isLeaderboardSelfHidden`. |
| `src/app/App.jsx` | Branch `handleDashboardHide` / `handleConfirmHide` on `post.leaderboard`; route to leaderboard-self path. Adjust `highlightedPostIsHidden` derivation likewise. |
| `src/features/feed/PostsTab.jsx` | Plumb `cloneHidden` + `rationales` through the mapped post shape (so they reach `LeaderboardBlock` and `InferenceChainPanel`). |
| `src/features/feed/LeaderboardBlock.jsx` | Honor `cloneHidden[]` + `isLeaderboardSelfHidden(boardId)`; render hidden-row variant. |
| `src/features/feed/leaderboardBlock.css` | Drop border + top radius; bump title, padding, row gap, bar height; add `--hidden` modifier. |
| `src/features/inferenceChain/InferenceChainPanel.jsx` | Branch on `post.leaderboard`; new `LeaderboardRationaleView` sibling component (may live in its own file under `src/features/inferenceChain/`). |
| `src/features/inferenceChain/inferenceChain.css` | Styles for the rationale rows. |
| `src/features/profile/tabs/LeaderboardsTab.jsx` | Group by persona; render three sections with persona-accented headers. |
| `src/styles/profile.css` | Section header styling + spacing. |
| `tests/leaderboardRationales.test.js` | New unit test: `cloneHiddenForBoard` determinism; parser accepts well-formed LLM output; falls back to template on malformed output. |
| `tests/liveScoringLeaderboardHide.test.js` | New unit test: `hideLeaderboardSelf` debits the right persona; reveal restores; key shape can't collide with `postKey`. |

## 7. Out of scope (flag if you want included)

- Guaranteed persona rotation in `pickBoardToPost`. The current all-productivity feed is a data artifact, not a system bug; will resolve naturally as new posts generate. If the demo needs immediate persona variety, add a small persona-bias term to the priority tiebreaker.
- Animations for the hidden-row transition (today the regular hide flow uses a particle arc; the row-hide is currently planned as an instant swap).
- Multi-viewer semantics ("what does another user see when I hide my row") — this remains a single-tenant demo; the persisted `cloneHidden[]` is the closest thing to "other users have hidden themselves" we model.
- A "regenerate rationales" button on the panel.
