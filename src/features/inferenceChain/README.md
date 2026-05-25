# inferenceChain — "Tell me more" feature

Reveals the 4-step algorithmic reasoning chain (`data → classify → infer → generate`) the post generator used to produce a given post, including a deliberate "bias note" on the inference step.

## What lives here

| File | Purpose |
| --- | --- |
| `TellMeMorePill.jsx` | Dashboard pill button. Mirrors the hide-pill state machine (`normal` / `armed` / `nudge` / `expanded`). When expanded it renders the panel. |
| `InferenceChainPanel.jsx` | The expanded view: header + 4 step rows + close button. Falls back to "Analysis not available for this post." when the chain is missing or malformed. |
| `inferenceChainSteps.jsx` | Step-row primitives. `StepRow` for DATA/CLASSIFY, `InferStepRow` (bias note), `GenerateStepRow` (quote framing). |
| `inferenceChain.css` | All styles for the pill states, expansion animation, and the panel internals. Re-uses the visual grammar of `.dashboard-hide-pill` (radii, glow cadence, nudge wiggle). |

## How it ties into the rest of the app

1. **Generator** — `server/lib/personaPostGenerator.js` appends an `INFERENCE_CHAIN_INSTRUCTION` to every slot's system prompt so the LLM returns `{"content","sentiment","inferenceChain":[…4 steps…]}`. The chain is validated and persisted on each post in `posts/{id}.json`.
2. **Mapping** — `src/features/feed/PostsTab.jsx` carries `inferenceChain` through into the enriched post object handed to `PostCard.onHighlight`, so `highlightedPost` in `App.jsx` already has it.
3. **Dashboard** — `src/app/App.jsx` renders `<TellMeMorePill>` inside `.dashboard-tell-row`. When expanded it adds `is-tell-expanded` to the dashboard capsule, which fades out the primary row and makes the tell row span the freed grid space.

## States (at a glance)

| State | Trigger | Visual |
| --- | --- | --- |
| `normal` | no post highlighted | pastel fill, accent border, icon @ 50% opacity |
| `armed` | post highlighted | bumped radius, accent-glow pulse, icon @ 100% |
| `nudge` | clicked with no selection | wiggle + "Select a post first" pill |
| `expanded` | clicked while armed | panel slides into the dashboard capsule, replaces primary + tell rows |

If a post predates this feature, the panel shows the fallback empty state without breaking the rest of the dashboard.
