# Leaderboard Visual Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `LeaderboardBlock` from a styled list into a chart-grade visual — persona-colored panel, mono ranks, horizontal bars sized by rank, black bar for the user / white for clones.

**Architecture:** Pure frontend restyle of one React component (`src/features/feed/LeaderboardBlock.jsx`) and its CSS sibling. No backend, no data-shape changes. The post envelope (`post.leaderboard.entries[]`) is read as-is. Bar widths come from inline `style={{ width }}` derived from `entry.rank` via the formula `((6 - rank) / 5) * 100%`.

**Tech Stack:** React 18, plain CSS using existing design tokens (`--post-accent`, `--ink`, `--border`, `--font-avant`, `--font-avant-book-oblique`, `--radius-post-surface`, `--capsule-shell-border-width`), Vitest 4 with `react-dom/server.renderToStaticMarkup` for SSR-based tests.

**Spec:** `docs/superpowers/specs/2026-05-26-leaderboard-visual-design.md`

---

## Task 1: Update tests for the new visual contract

**Files:**
- Modify: `tests/leaderboardBlock.test.jsx`

We add two new test cases (bar-width and zero-padded rank) and tighten the existing "renders 5 rows in rank order" check. The other 6 tests stay intact — outer structure (title, --self class, delta chip, no scores, identical Alex rows, null guard) is unchanged by this restyle.

- [ ] **Step 1: Read the current test file to confirm starting state**

Run: `cat tests/leaderboardBlock.test.jsx | wc -l`
Expected: ~95 lines covering 8 tests, all currently passing against the existing component.

- [ ] **Step 2: Add the new test cases at the end of the existing `describe('<LeaderboardBlock>', ...)` block (before its closing `});`)**

Edit `tests/leaderboardBlock.test.jsx` and append these two tests inside the existing `describe(...)`. Place them after the existing `it('renders nothing when leaderboard is null or malformed', ...)` test:

```jsx
  it('zero-pads the rank display (01..05)', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    for (const rank of ['01', '02', '03', '04', '05']) {
      expect(html).toContain(`>${rank}<`);
    }
    // The bare digits 1..5 should NOT appear as the rank label — they're zero-padded.
    expect(html).not.toMatch(/>1</);
    expect(html).not.toMatch(/>5</);
  });

  it('renders rank-derived bar widths (100%, 80%, 60%, 40%, 20%)', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    for (const pct of ['100%', '80%', '60%', '40%', '20%']) {
      // Inline style on the bar fill: width:<pct>
      expect(html).toMatch(new RegExp(`width:\\s*${pct.replace('%', '\\%')}`));
    }
  });

  it('user row contains a bar fill (highlighting handled in CSS, not markup)', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    // The user row keeps both `leaderboard-row` and `leaderboard-row--self`; its bar-fill
    // div lives inside that row. We verify the row contains a bar-fill element.
    const selfRowMatch = html.match(/<li[^>]*leaderboard-row--self[^>]*>([\s\S]*?)<\/li>/);
    expect(selfRowMatch).not.toBeNull();
    expect(selfRowMatch[1]).toContain('leaderboard-row__bar-fill');
  });
```

- [ ] **Step 3: Run the test file — confirm the new tests FAIL while the others pass**

Run: `cd /Users/brikeld/Documents/Repo/WebDiplome && npx vitest run tests/leaderboardBlock.test.jsx`
Expected: 8 prior tests still PASS, the 3 new tests FAIL because (a) the current component renders `#1`..`#5` not `01`..`05`, (b) no bar-fill element exists yet, (c) no `width:NN%` inline style is emitted.

- [ ] **Step 4: Commit (failing tests only — implementation comes in Task 2)**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add tests/leaderboardBlock.test.jsx
git commit -m "test(feed): add bar-width, zero-pad rank, bar-fill assertions"
```

This is a deliberate red-state commit. Implementation lands in Task 2.

---

## Task 2: Rewrite LeaderboardBlock JSX + CSS for chart-style visual

**Files:**
- Modify: `src/features/feed/LeaderboardBlock.jsx`
- Modify: `src/features/feed/leaderboardBlock.css`

JSX changes the `<Row>` sub-component shape from a 1-line grid to a 2-line block (header row + bar row). CSS replaces the file wholesale.

- [ ] **Step 1: Rewrite `<Row>` in `src/features/feed/LeaderboardBlock.jsx`**

Find the existing `function Row({ entry })` (it currently returns a `<li>` with a 4-column grid). Replace it with the 2-line version below. All other code in the file (imports, `DeltaChip`, default-export `LeaderboardBlock`) stays exactly as-is — do NOT modify them.

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

- [ ] **Step 2: Replace the entire contents of `src/features/feed/leaderboardBlock.css`**

Wholesale replacement. The old per-row card background + 1px border on `--self` is gone; the new design uses persona panel + black bar to highlight the user.

```css
.leaderboard-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px 28px;
  border-radius: var(--radius-post-surface);
  background: var(--post-accent);
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
  gap: 12px;
}

.leaderboard-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  background: transparent;
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
  background: #fff;
}

.leaderboard-row--self .leaderboard-row__bar-fill {
  background: var(--ink);
}

.leaderboard-row--self .leaderboard-row__name {
  font-weight: 700;
}
```

- [ ] **Step 3: Run the failing tests — confirm they all PASS now**

Run: `cd /Users/brikeld/Documents/Repo/WebDiplome && npx vitest run tests/leaderboardBlock.test.jsx`
Expected: ALL 11 tests pass (8 prior + 3 added in Task 1).

- [ ] **Step 4: Run the full vitest suite to confirm no regressions**

Run: `cd /Users/brikeld/Documents/Repo/WebDiplome && npm test 2>&1 | tail -10`
Expected: All passing tests stay passing; the 2 pre-existing `liveScoring.test.js` failures remain unchanged. Specifically, the `tests/postCardLeaderboard.test.jsx` tests must still pass (their assertions are about presence/absence of `leaderboard-block`, not internal markup).

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add src/features/feed/LeaderboardBlock.jsx src/features/feed/leaderboardBlock.css
git commit -m "feat(feed): chart-style leaderboard visual (persona panel + rank bars)"
```

---

## Task 3: Manual visual smoke test in the running app

**No new files.** Verify the restyled component looks right in the actual UI.

- [ ] **Step 1: Confirm the servers + LM Studio are reachable**

```bash
curl -s -o /dev/null -w "%{http_code} (3001)\n" --max-time 3 http://localhost:3001/api/profiles
curl -s -o /dev/null -w "%{http_code} (3010)\n" --max-time 3 http://localhost:3010
curl -s -o /dev/null -w "%{http_code} (LM Studio)\n" --max-time 3 http://192.168.1.109:1234/v1/models
```
Expected: `200 (3001)`, `404 (3010)` (no GET root — that's normal), `200 (LM Studio)`. If any of these are not running, start `npm run servers` in one terminal, ensure LM Studio is loaded with a context window ≥ 32k. Frontend: run `npm run dev` in another terminal and open the printed URL.

- [ ] **Step 2: Check that at least one leaderboard post already exists in the feed**

```bash
jq '[.[] | select(.leaderboard != null)] | length' /Users/brikeld/Documents/Repo/WebDiplome/posts/brikeld-hoxha.json
```
Expected: ≥ 1. If 0, click "GENERATE NEW CONTENT" in the UI once to produce one (or POST to the generate endpoint via `curl -X POST http://localhost:3010/api/posts/generate-stream -H "Content-Type: application/json" -d '{}'` and wait ~60s).

- [ ] **Step 3: Open the feed in the browser and visually verify the leaderboard post**

Navigate to the feed. Find a leaderboard post (it'll have the structured top-5 below the post bubble). Confirm by eye:

1. The leaderboard block has a SOLID persona-colored background (light gray for productivite, blue for securite, lime for popularite) — NOT white.
2. The title (`TOP 5 MOST PRODUCTIVE` or similar) is uppercase, mono font, top-left of the header.
3. The delta chip (`NEW` / `▲ from #N` / `▼ from #N`) sits top-right of the header. `NEW` and `▲` chips are filled BLACK with white text; `▼` is white with black text.
4. Each of the 5 rows shows: `01`–`05` (zero-padded) in mono, a 24px circular avatar, the name (bold), the handle (oblique, muted), followed BELOW by a horizontal bar.
5. Bar widths decrease in 20% increments down the list (#1 = full, #5 = one-fifth).
6. The user's row (Brikeld's, the one not named "Alex Johnson") has a BLACK bar fill; all other (clone) rows have WHITE bar fills.
7. The user's name is slightly heavier weight than the clones.

If anything looks off, fix in `leaderboardBlock.css` or `LeaderboardBlock.jsx` and re-test before committing.

- [ ] **Step 4: Verify across all 3 persona colors**

The current leaderboard posts on disk should cover at least 2 personas. To force the third, trigger generation a few more times until you've seen the block rendered on `#D8D8D8` (productivite/gray), `#759AEF` (securite/blue), and `#CCF847` (popularite/lime) backgrounds. Black bar + white bars must remain readable on all three.

- [ ] **Step 5: If everything checks out, ensure no incidental changes**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git status
```
Expected: any uncommitted changes are unrelated to this task (e.g. pre-existing in-flight work). If something accidentally changed in `LeaderboardBlock.jsx` or `leaderboardBlock.css` during manual testing, review and either discard or commit deliberately.

---

## Notes

- **Why no test for the persona background color:** CSS background-color isn't reflected in the SSR markup that vitest tests; verifying it requires real-browser rendering. Step 3 of Task 3 covers it manually.
- **Why bar-width is tested but bar-color isn't:** Bar width comes from inline `style={{ width }}` which IS in the SSR markup. Bar color comes from CSS class targeting which isn't observable from `renderToStaticMarkup`.
- **Why the JSX + CSS land in one commit:** The new CSS selectors (`.leaderboard-row__header`, `.leaderboard-row__bar-track`, `.leaderboard-row__bar-fill`) only make sense alongside the JSX that emits them. Splitting would leave an intermediate broken visual state.
