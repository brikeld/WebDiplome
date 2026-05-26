# Leaderboard Post Visual — Design

**Date:** 2026-05-26
**Status:** Draft, pending implementation plan
**Scope:** Restyle the existing `LeaderboardBlock` React component so each leaderboard post carries a chart-style visual (persona-colored panel, mono ranks, horizontal bars sized by rank) instead of the current text-only row list. No backend or data-shape changes.

## 1. Goal

Give the leaderboard post type a chart-grade visual that stylistically rhymes with the existing AI Tool Exposure chart while staying a React component (so we keep avatars, accessibility, and the `--post-accent` theme system). The visual must:

- Show all 5 entries from `post.leaderboard.entries`.
- Highlight the generating user with a clearly different bar fill color (the user's row stands out at a glance).
- Carry a title that names the board (e.g. `TOP 5 MOST PRODUCTIVE`).
- Look clean and professional, matching the project's design-token aesthetic — persona color as panel background, mono font for ranks/title, sans for names.

## 2. Constraints

- **No backend changes.** The `post.leaderboard` JSON shape stays the same (`boardId`, `title`, `userRank`, `previousUserRank`, `entries[5]` each with `{ rank, name, handle, avatarSrc, avatarInitials, score, isUser }`). Score remains in the data but is NOT rendered.
- **React component, not server PNG.** This is a restyle of `src/features/feed/LeaderboardBlock.jsx`, not a new server-side chart function. The component stays mounted inside `PostCard`'s `post-unified-capsule` in the same slot it occupies today.
- **All-Alex visual repetition stays.** Four rows literally render as "Alex Johnson" — that's intentional.
- **No new design tokens.** Reuse `--post-accent`, `--ink`, `--border`, `--font-avant`, `--font-avant-book-oblique`, `--radius-post-surface`, `--capsule-shell-border-width`.

## 3. Visual layout

```
┌─ leaderboard-block (persona-color background) ──────────────────┐
│                                                                  │
│  TOP 5 MOST PRODUCTIVE                                ▲ from #2  │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  01  [AJ]  Alex Johnson      @AlexLaptop                         │
│            ██████████████████████████████████████████████████    │  ← white fill (100%)
│                                                                  │
│  02  [BH]  Brikeld Hoxha     @brikeld-mbp                        │  ← .leaderboard-row--self
│            ██████████████████████████████████████████            │  ← black fill (80%)
│                                                                  │
│  03  [AJ]  Alex Johnson      @AlexLaptop                         │
│            ██████████████████████████████                        │  ← white fill (60%)
│                                                                  │
│  04  [AJ]  Alex Johnson      @AlexLaptop                         │
│            ████████████████████████                              │  ← white fill (40%)
│                                                                  │
│  05  [AJ]  Alex Johnson      @AlexLaptop                         │
│            ██████████████████                                    │  ← white fill (20%)
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Per-element specifics:**

- **Panel background:** `--post-accent`. Already set on the element by the parent `PostCard` via `style={{ '--post-accent': noteColor }}`. Resolves to:
  - productivite → `#D8D8D8`
  - securite → `#759AEF`
  - popularite → `#CCF847`
- **Border + corner radius:** identical to today (`var(--capsule-shell-border-width) solid var(--border)`, `var(--radius-post-surface)`).
- **Title** (`TOP 5 MOST PRODUCTIVE`): mono font, bold 700, uppercased via `text-transform: uppercase` (data still reads "Top 5 Most Productive" so screen readers get correct casing), `letter-spacing: 0.05em`.
- **Delta chip** (`NEW` / `▲ from #N` / `▼ from #N`): unchanged from current implementation, sits top-right of header.
- **Rank tag** (`01`, `02`, ...): 2-digit zero-padded, mono font, bold 700, `opacity: 0.55`. Matches AI Tool Exposure.
- **Avatar:** 24px circular, sits between rank and name. Uses `entry.avatarSrc` if present (the Alex Johnsons use `/imgs/AlexP.png`), otherwise falls back to `entry.avatarInitials`.
- **Name** (sans, weight 600) + **handle** (oblique sans, opacity 0.6) sit on the same line as rank + avatar.
- **Bar track:** full-width row, `height: 10px`, `border-radius: 5px`, `background: rgba(0, 0, 0, 0.08)` — a faint groove on the persona panel.
- **Bar fill:**
  - Clone rows: `background: #fff` (matches `viz` in `chartPalette`).
  - User row (`.leaderboard-row--self`): `background: var(--ink)` (black on persona for high contrast).
  - Width: inline style `width: ((6 - entry.rank) / 5 * 100) + '%'`. Rank 1 → 100%, rank 2 → 80%, …, rank 5 → 20%.
  - Height inherits from track; `border-radius: 5px`.
- **Spacing:** `padding: 22px 28px` on the block (unchanged), `gap: 14px` between header and rows, `gap: 12px` between consecutive rows, `gap: 6px` between a row's header line and its bar.

## 4. JSX structure

Inside `src/features/feed/LeaderboardBlock.jsx`, the `<Row>` sub-component changes from a 1-line grid to a 2-line block:

```jsx
function Row({ entry }) {
  const cls = `leaderboard-row${entry.isUser ? ' leaderboard-row--self' : ''}`;
  const widthPct = ((6 - entry.rank) / 5) * 100;
  return (
    <li className={cls}>
      <div className="leaderboard-row__header">
        <span className="leaderboard-row__rank">{String(entry.rank).padStart(2, '0')}</span>
        <span className="leaderboard-row__avatar" aria-hidden>
          {entry.avatarSrc
            ? <img className="leaderboard-row__avatar-img" src={entry.avatarSrc} alt="" />
            : <span className="leaderboard-row__avatar-initials">{entry.avatarInitials}</span>}
        </span>
        <span className="leaderboard-row__name">{entry.name}</span>
        <span className="leaderboard-row__handle">{entry.handle}</span>
      </div>
      <div className="leaderboard-row__bar-track">
        <div className="leaderboard-row__bar-fill" style={{ width: `${widthPct}%` }} />
      </div>
    </li>
  );
}
```

Outer structure (`<header>` + `<ul aria-labelledby>` + `<DeltaChip>` + default-export shape) is unchanged.

The pre-existing null-guard at the top of `LeaderboardBlock` (`if (!leaderboard || !Array.isArray(leaderboard.entries)) return null;`) stays.

## 5. CSS changes (whole-file replacement)

`src/features/feed/leaderboardBlock.css` gets a focused rewrite. The selectors that already exist (`.leaderboard-block`, `.leaderboard-row`, `.leaderboard-row--self`, `.leaderboard-delta*`, etc.) keep their names; their declarations evolve as listed below. New selectors: `.leaderboard-row__header`, `.leaderboard-row__bar-track`, `.leaderboard-row__bar-fill`.

```css
.leaderboard-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px 28px;
  border-radius: var(--radius-post-surface);
  background: var(--post-accent);          /* persona panel — was var(--card) */
  border: var(--capsule-shell-border-width) solid var(--border);
  color: var(--ink);
}

.leaderboard-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.leaderboard-block__title {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
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
  background: rgba(255, 255, 255, 0.55);   /* readable on any persona color */
  color: var(--ink);
  white-space: nowrap;
}
.leaderboard-delta--new,
.leaderboard-delta--up   { background: var(--ink); color: #fff; }
.leaderboard-delta--down { background: rgba(255, 255, 255, 0.55); opacity: 0.85; }

.leaderboard-block__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.leaderboard-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  background: transparent;                 /* no per-row fill anymore */
  color: var(--ink);
  font-family: var(--font-avant);
}

.leaderboard-row__header {
  display: grid;
  grid-template-columns: 32px 24px 1fr auto;
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
  width: 24px;
  height: 24px;
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
  height: 10px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.leaderboard-row__bar-fill {
  height: 100%;
  border-radius: 5px;
  background: #fff;                        /* matches chartPalette.viz */
}

.leaderboard-row--self .leaderboard-row__bar-fill {
  background: var(--ink);                  /* black on persona for the user */
}

.leaderboard-row--self .leaderboard-row__name {
  font-weight: 700;
}
```

The OLD selectors `.leaderboard-row--self { background, border }` block from the prior design is removed — the per-row background card and border are gone; the row is now a transparent two-line strip on the persona panel.

## 6. Test changes

`tests/leaderboardBlock.test.jsx` already has 8 tests after Task 8 fixes. Update / add:

1. **Keep existing:** title renders, 5 rows in rank order, user has `--self`, delta chip cases (`▲`, `NEW`), no score numbers in markup, 4 identical Alex rows, null guard.
2. **Update** the "renders 5 rows in rank order" regex if needed — current `/<li class="leaderboard-row(?:--self|"| )/g` continues to match `leaderboard-row` and `leaderboard-row leaderboard-row--self` openings since the row className shape is unchanged.
3. **Add** a test that the bar fill renders the correct rank-derived width: assert the markup contains `width:100%` for rank 1, `width:80%` for rank 2, etc. (or use a regex that tolerates whitespace).
4. **Add** a test asserting the rank text is zero-padded: `expect(html).toContain('>01<')` etc.

`tests/postCardLeaderboard.test.jsx` stays untouched (its assertions are about presence/absence of `leaderboard-block`, not internal markup).

## 7. Behavior + accessibility

- The `<h3>` retains its `id` so the `<ul aria-labelledby={id}>` continues to announce the list with the board name.
- The avatar element keeps `aria-hidden` (decorative).
- The bar fill is purely visual — no aria role added. Screen readers see "01 Alex Johnson @AlexLaptop" per row, which is sufficient.
- Color contrast: black text on `#D8D8D8` ≈ 13:1 (passes); on `#759AEF` ≈ 6:1 (passes); on `#CCF847` ≈ 14:1 (passes).

## 8. Files touched

```
MODIFY  src/features/feed/LeaderboardBlock.jsx       (Row sub-component)
REWRITE src/features/feed/leaderboardBlock.css       (full file)
MODIFY  tests/leaderboardBlock.test.jsx              (add bar-width + zero-pad tests)

NO CHANGE  src/features/feed/PostCard.jsx
NO CHANGE  server/lib/leaderboards.js
NO CHANGE  server/lib/personaPostGenerator.js
NO CHANGE  server/lib/prompts.js
NO CHANGE  posts/{id}.json shape
```

## 9. Out of scope

- Changing the post-bubble avatar, comments capsule, or any other surrounding PostCard chrome.
- Adding a "browse all leaderboards" UI (still deferred from the original feature spec).
- Animating the bars in / on rank change.
- Showing the raw `score` number anywhere.

## 10. Risks / decisions

1. **Persona bg vs surrounding white capsule:** the parent `post-unified-capsule` is white. Putting a persona-colored panel inside a white capsule visually rhymes with how chart posts work (chart PNG is persona-colored, sitting inside a white capsule). Same pattern.
2. **Bar-fill color for the user (`var(--ink)` = black):** chosen for highest contrast against any of the three persona colors. White-on-persona for clones is already the chart `viz` convention. Inverting the user to black both calls out their row AND avoids the visual confusion of "user has a bigger bar than #1" (the user's bar is always shorter when they're not #1, which feels self-deprecating in keeping with the project's satirical voice).
3. **Delta chip on persona bg:** the old `--panel-muted` chip background washes out on `#D8D8D8`. Switched to `rgba(255,255,255,0.55)` for the neutral chip and `var(--ink)` for the active chip (NEW/▲) to maintain contrast.
4. **Mono font (`ui-monospace, 'SF Mono', Menlo, monospace`):** matches the existing chart text family from `chartGenerator.js`. Falls through gracefully on non-Apple systems.
