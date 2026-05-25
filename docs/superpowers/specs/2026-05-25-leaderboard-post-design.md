# Leaderboard Post — Design

**Date:** 2026-05-25
**Status:** Draft, pending implementation plan
**Scope:** Add a 4th conditional post type ("leaderboard") to the persona post generator. Backend logic + post-card rendering only; no browse UI.

## 1. Goal

Introduce a 4th post type — **leaderboard** — alongside the existing `text`, `asset`, and `chart` slots in `generatePersonaPosts`. A leaderboard post ranks the current user against 4 fake clones across one of 7 themed boards, and fires when the user's rank on that board changes (or appears for the first time).

The system intentionally fits the project's satire-of-surveillance voice: the algorithm classifies the user with confident-but-shallow heuristics, and the LLM comments on the user's position in the same biased voice used elsewhere.

## 2. The 7 leaderboards

Each board has a stable `id`, a display `title`, a `persona` (drives the post accent color), and a `peakHour` (0–23) for time-decay. Each board's `scoreFn(dataJson, profile, nowMs)` returns `{ score, hint }` — `score` is a number used for ranking, `hint` is a one-line human-readable string (e.g., `"high work-app usage this morning, no entertainment apps opened in the last hour"`) passed into the LLM context as `scoreReasonsHint` (never rendered in the UI). Scoring formulas are intentionally simple ("you can cheat a little bit") and read raw fields from the Electron app's `data.json`.

| id                        | title                                  | persona      | peak hr | scoring formula (sketch)                                                                |
|---------------------------|----------------------------------------|--------------|---------|------------------------------------------------------------------------------------------|
| `most_productive`         | Top 5 Most Productive                  | productivite | 11      | `Σ work+creative app usage − Σ entertainment app usage`, × `(1 + 0.3·decay)`            |
| `closest_to_burnout`      | Top 5 Closest to Burnout               | productivite | 23      | `late-night screenshots + work hours/day + back-to-back app switches`, × `(1 + 0.4·decay)` |
| `most_likely_change_jobs` | Top 5 Most Likely to Change Jobs (30d) | productivite | 15      | `LinkedIn/job-board hits + low recent file output + Slack/Teams ratio`, × `(1 + 0.3·decay)` |
| `ignoring_health`         | Top 5 Most Likely Ignoring Health      | productivite | 1       | `late-night activity + café-wifi count + no health-app installed`, × `(1 + 0.3·decay)`  |
| `most_secure`             | Top 5 Most Secure                      | securite     | 9       | `(VPN apps installed)·30 + low-public-wifi-count − torrent apps`, × `(1 + 0.2·decay)`   |
| `most_socially_isolated`  | Top 5 Most Socially Isolated           | popularite   | 22      | `low social-app usage + low wifi diversity + few social-domain browser hits`, × `(1 + 0.3·decay)` |
| `most_likely_ghost`       | Top 5 Most Likely to Ghost You         | popularite   | 20      | `low recent comms-app activity + many app switches away from chat`, × `(1 + 0.3·decay)` |

**Time-decay**: `decay(nowHour, peakHour) = cos((nowHour − peakHour) × π / 12)`, range `[-1, 1]`. Score formulas multiply by `(1 + k·decay)` so the same harvested `data.json` yields different scores throughout the day. Without this term, single-user demo state would be frozen.

**Persona distribution** (drives `post.persona`, accent theming): 4 productivite / 1 securite / 2 popularite.

## 3. Participants — real user + 4 Alex-Johnson clones

The leaderboard always renders the current real user plus **4 fake clones, all identified as "Alex Johnson"** — same display name, handle (`@AlexLaptop`), and avatar (`/imgs/AlexP.png`) as `DEMO_OTHER_COMMENTER` in `src/lib/demoCommentIdentity.js`. The clones are deliberately identical in the UI; this is the intended look.

Internally each clone has a stable `cloneIdx` (0–3). `scoreCloneFor(boardId, cloneIdx, nowMs)` returns a deterministic score that drifts over time:

```js
scoreCloneFor(boardId, cloneIdx, nowMs) {
  const bucket = Math.floor(nowMs / 600_000);  // 10-minute drift bucket
  const seed = hash(`${boardId}|${cloneIdx}|${bucket}`);
  return mapSeedToBoardRange(seed, boardId);   // each board tunes its target range
}
```

`mapSeedToBoardRange` shapes the per-board distribution so clone scores land in roughly the same magnitude as plausible user scores — close enough that clones can occasionally outrank the real user when the user's time-decay (or data) is unfavorable. The 10-minute bucket ensures perceptible rank churn during a single demo session without thrashing on every click.

## 4. Slot integration

A 4th slot is added to `generatePersonaPosts` in `server/lib/personaPostGenerator.js`. Unlike the other 3 slots, it is **conditional**: if no board's rank has changed since the last leaderboard post for that board, the slot returns `null` and no leaderboard post is appended.

```
generatePersonaPosts() now runs 4 slots in parallel:
  [textSlot, assetSlot, chartSlot, leaderboardSlot]
                                   ^^^^^^^^^^^^^^^
                                   may resolve to null
```

`buildLeaderboardSlot(dataJson, profile, existingPosts, baseUserPayload)`:

1. Compute the current standings for all 7 boards. For each board:
   - Score the real user via `const { score, hint } = board.scoreFn(dataJson, profile, Date.now())`.
   - Score the 4 clones via `scoreCloneFor(board.id, idx, Date.now())`.
   - Sort all 5 by score desc → assign `rank` 1–5 → extract `userRank`. Retain `hint` alongside the standing for downstream LLM context.
2. Look up `prevRankByBoard`: for each `boardId`, find the most recent post in `existingPosts` with `post.leaderboard?.boardId === boardId`, take its `leaderboard.userRank`. Missing entry → `null` (board never posted).
3. For each board compute `delta = prevRank == null ? 5 : Math.abs(userRank - prevRank)`. First appearance counts as max delta.
4. Pick the board with the highest delta. Ties broken by board priority order (declared once in `BOARDS` array). If all deltas are 0 → return `null` (no leaderboard post this run).
5. Build a slot context that includes the board title, the user's `userRank`, `previousUserRank`, and a one-line "score reason hint" derived from the heuristic. Run through the standard `runSlot()` LLM path using a new `leaderboard` prompt key.

**Generation pipeline (high level):**

```
                       /api/posts/generate (server-generate.js)
                                    │
                                    ▼
                       prepareGenerationContext()
                                    │
                                    ▼
                       generatePersonaPosts({ ... })
                       ┌────────────┼────────────┬───────────────────┐
                       ▼            ▼            ▼                   ▼
                   textSlot     assetSlot    chartSlot       leaderboardSlot
                       │            │            │                   │
                       │            │            │            compute 7 standings
                       │            │            │            diff vs prior posts
                       │            │            │            pick max-delta board
                       │            │            │            (or return null)
                       ▼            ▼            ▼                   ▼
                  LLM ─→ post   LLM ─→ post  LLM ─→ post     LLM ─→ post (with .leaderboard)
                       \            |            /                   /
                        \           |           /                   /
                         ▼          ▼          ▼                   ▼
                              appendPersonaPosts(id, posts.filter(Boolean))
                              (slot returning null is silently dropped)
```

## 5. Post anatomy

Same envelope as other posts (`content`, `sentiment`, `inferenceChain` 4-step, `ingredients` 3-entry, `highlights`) plus a new structured `leaderboard` field:

```jsonc
{
  "persona": "productivite",
  "content": "Climbed to 1st in Most Productive this week — the algorithm calls it 'high signal.'",
  "sentiment": "positive",
  "createdAt": "2026-05-25T18:00:00.000Z",
  "inferenceChain": [/* 4 steps: data → classify → infer → generate */],
  "ingredients":    [/* 3 ingredients with weights + dataPoints */],
  "highlights":     [/* 2–3 phrases mapped to chain + ingredient indices */],
  "leaderboard": {
    "boardId": "most_productive",
    "title": "Top 5 Most Productive",
    "userRank": 1,
    "previousUserRank": 2,
    "entries": [
      { "rank": 1, "name": "Brikeld Hoxha", "handle": "@brikeld",     "avatarSrc": "/uploads/<hash>.jpg",   "score": 87 },
      { "rank": 2, "name": "Alex Johnson",  "handle": "@AlexLaptop",  "avatarSrc": "/imgs/AlexP.png",       "score": 81 },
      { "rank": 3, "name": "Alex Johnson",  "handle": "@AlexLaptop",  "avatarSrc": "/imgs/AlexP.png",       "score": 74 },
      { "rank": 4, "name": "Alex Johnson",  "handle": "@AlexLaptop",  "avatarSrc": "/imgs/AlexP.png",       "score": 68 },
      { "rank": 5, "name": "Alex Johnson",  "handle": "@AlexLaptop",  "avatarSrc": "/imgs/AlexP.png",       "score": 61 }
    ]
  }
}
```

`entries[].score` is retained in the JSON so future analysis or sort-stability checks work, but the UI does **not** render score values or score bars — only positions.

`previousUserRank` is `null` for first-ever appearance on a board. `LeaderboardBlock` uses this to render the delta chip (`NEW` vs `▲ from #N` vs `▼ from #N`).

## 6. State storage — derive from posts, no new state file

The "last posted rank per board" is **not** persisted in a separate state file. It is derived on each run from `existingPosts` (already passed into `buildLeaderboardSlot`):

```js
function priorRankByBoard(existingPosts) {
  const out = {};
  for (const p of existingPosts) {                // posts/{id}.json is newest-first
    const lb = p?.leaderboard;
    if (!lb || !lb.boardId) continue;
    if (out[lb.boardId] !== undefined) continue;  // first hit per board wins
    out[lb.boardId] = lb.userRank ?? null;
  }
  return out;
}
```

Source-of-truth = what's already on the feed. Side effects of this choice:

- Deleting a leaderboard post resets the trigger for that board (next run treats it as first appearance).
- No third file alongside `profiles/` and `posts/` to keep in sync.
- No write contention between the slot and a separate state writer.

## 7. LLM prompt — `leaderboard` slot

New entry in `DEFAULT_SLOT_PROMPTS` (and the Electron `prompts.json` fallback chain). Same envelope rules apply (the existing `injectInferenceChainInstruction()` is appended unchanged).

System-prompt shape (sketch):
> You write short social-media-style posts in the voice of a surveillance algorithm that has just placed the user on a top-5 leaderboard. Stay in 1–2 sentences. Acknowledge the rank (`{userRank}` of 5) and, when `previousUserRank` is provided, the move (climbed / dropped / new). The board is `{boardTitle}`. Lean into the algorithm's overconfident, slightly biased framing. Return the standard envelope with `content`, `sentiment`, `inferenceChain`, `ingredients`, `highlights`.

The slot context (`userPayload` for the LLM) embeds:

```
[Leaderboard slot]
Board: Top 5 Most Productive
Your rank: 1 (was 2)
Score signal hint: high work-app usage this morning, no entertainment apps opened in the last hour.

---
<existing baseUserPayload>
```

`scoreReasonsHint` is a one-line string the heuristic emits alongside the score — purely contextual, never displayed in the UI; it just steers the LLM toward grounded commentary.

## 8. Frontend rendering — `LeaderboardBlock`

New React component `src/features/feed/LeaderboardBlock.jsx` + `src/features/feed/leaderboardBlock.css`, rendered inside `PostCard`'s `post-unified-capsule` in the same slot that `PostImage` / `PostDocument` occupy for asset and chart posts. `PostCard.jsx` adds one branch:

```jsx
{post.leaderboard ? (
  <LeaderboardBlock leaderboard={post.leaderboard} accentColor={noteColor} />
) : null}
```

Layout (the score column and bar are deliberately absent — position + identity only):

```
┌─ leaderboard-block (persona accent) ─────────────────────────┐
│  TOP 5 MOST PRODUCTIVE                            ▲ from #2  │
│  ─────────────────────────────────────────────────────────── │
│  #1  [BH] Brikeld Hoxha     @brikeld                         │  ← .leaderboard-row--self
│  #2  [AJ] Alex Johnson      @AlexLaptop                      │
│  #3  [AJ] Alex Johnson      @AlexLaptop                      │
│  #4  [AJ] Alex Johnson      @AlexLaptop                      │
│  #5  [AJ] Alex Johnson      @AlexLaptop                      │
└──────────────────────────────────────────────────────────────┘
```

Styling rules:

- Uses existing tokens (`--post-accent`, `--persona-accent`). Persona inherited from `[data-persona]` on the parent `.post-card`.
- The user's row gets `.leaderboard-row--self` — subtle accent fill / border to call out position without redesigning the row.
- Delta chip top-right shows one of `NEW`, `▲ from #N`, `▼ from #N`, or hidden when `userRank === previousUserRank` (shouldn't happen — slot wouldn't have posted — but guard anyway).
- All 4 fake rows literally render as "Alex Johnson" / `@AlexLaptop` / `AlexP.png`. The uncanny repetition is intentional.

The leaderboard post still gets the `post-card-bubble` (lead text + avatar + system note pill) and the comments capsule — only the middle attachment region is replaced by `LeaderboardBlock` instead of an image or document.

## 9. File touch list

```
NEW   server/lib/leaderboards.js
NEW   src/features/feed/LeaderboardBlock.jsx
NEW   src/features/feed/leaderboardBlock.css

EDIT  server/lib/personaPostGenerator.js
        - add buildLeaderboardSlot()
        - add slot to slots[] in generatePersonaPosts()
        - extend runSlot() if leaderboard slot needs any extra envelope handling
EDIT  server/lib/prompts.js
        - DEFAULT_SLOT_PROMPTS.leaderboard
EDIT  src/features/feed/PostCard.jsx
        - branch on post.leaderboard
EDIT  Electron-side data/prompts.json (informational note in implementation plan;
        WebDiplome ships its own fallback so no cross-repo coupling at runtime)

NO CHANGE  server.js
NO CHANGE  posts/{id}.json schema (leaderboard is an additive optional field)
NO CHANGE  profiles/{id}.json
```

## 10. Behavior summary

- User opens the app and clicks "Generate new content."
- 4 slots run in parallel. Leaderboard slot computes 7 board standings, finds the max-delta board, asks the LLM for commentary.
- If no rank changed since the last post for any board → the slot resolves to `null` and only 3 posts append. The UI shows the same 3 categories it does today.
- Otherwise a 4th post appears in the feed with `LeaderboardBlock` rendered inline, same vibe as other posts but with a 5-row ranking instead of an image/chart/document.
- Over time, as the user's data shifts and clones drift (10-minute buckets), the user's rank changes on different boards and leaderboard posts continue to surface.

## 11. Out of scope

- Browse-all-leaderboards UI (`/leaderboards`, modal, profile-tab integration) — explicitly deferred.
- Multi-real-user support — the rest of WebDiplome is single-tenant; leaderboards inherit that.
- Persisted historical rank graphs ("you've been #1 in Most Productive for 3 days") — deferred.
- Editing/regenerating an individual leaderboard post — uses the same flow as other posts (delete + regenerate).

## 12. Risks / open considerations for the plan

1. **Clone score calibration**: `mapSeedToBoardRange` per board must be tuned so clones don't always lose or always win. Implementation plan should include a smoke test that runs `computeBoardStanding` over a synthetic 24-hour day and verifies the user's rank distribution includes at least two distinct rank values per board.
2. **LLM JSON envelope failures**: the existing fallback in `parsePostResponse` handles malformed responses, but the leaderboard slot specifically needs `previousUserRank` reasoning to be coherent. If `content` ends up unrelated to the rank delta, the post still appends but reads oddly. Acceptable for v1 — same failure mode the other slots have.
3. **Persona inference**: 4 of 7 boards map to `productivite`. If the user happens to hit only productivite-mapped board deltas, the leaderboard post type will look like a 4th productivity post in the feed. Acceptable — board variety over time will surface other personas.
4. **First-run fan-out cap**: on a brand-new profile, every board is a "first appearance" (delta = 5). The "one post per run" cap means only one leaderboard fires on run 1; the others surface on subsequent generations as their deltas remain max until they post for the first time. Document this clearly in the plan so it isn't read as a bug.
