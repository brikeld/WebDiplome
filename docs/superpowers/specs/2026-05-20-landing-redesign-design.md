# Landing Page Redesign — Design Spec
Date: 2026-05-20

## Goal

Redesign `LandingPage.jsx` + `landingPage.css` from scratch (Approach A — full rewrite). Switch from a dark-theme, free-flowing scroll to a white-background, black-text, 5-screen (5 × 100vh) layout. Persona colors are restricted to the profile preview and persona-explanation cards only.

## Color Rules

| Context | Background | Text | Persona colors |
|---|---|---|---|
| Global | `#fff` | `#000` | No |
| Profile preview (Screens 2 & 5) | inherited | inherited | Yes — avatar ring, badge, post accent |
| Persona cards (Screens 4 & 5) | persona color fill | `#000` | Yes — card background |
| Workflow cards (Screens 3 & 5) | `#fff` | `#000` | No |

Persona color values remain unchanged: `#D8D8D8` (productivity), `#759AEF` (security), `#CCF847` (popularity).

## Typography

- Font: `var(--font-avant)` throughout — unchanged
- "COMPLIANT" title: solid `#000`, `clamp(96px, 18vw, 560px)`, weight 800, no gradient, no animation
- Section titles ("workflow in 3 parts.", "the 3 personas.", "screen resume of everything."): large black, left-aligned, no colored capsule backgrounds
- Body / lede text: `#000`, weight 500

## Layout System

- Every screen is exactly `100vh`, `box-sizing: border-box`
- Edge padding: `clamp(20px, 5vw, 64px)` left and right on all screens
- Cards: `border-radius: 24px`, `border: 2px solid #000`
- Gap between cards in a row: `16px`

---

## Screen 1 — Hero (100vh)

**Layout:** identical to current — full-width COMPLIANT title at the top, subtitle pinned to bottom-left.

- `COMPLIANT`: solid black, no gradient animation removed
- Subtitle: "Who are you really? / *Let our algorithm answer that for you.*" — black, same size (`var(--lp-mega-title)`), italic `<em>` for the second line
- Background: white
- Topbar: same `debug` button, color flipped to `rgba(0,0,0,0.35)` on white

---

## Screen 2 — Profile + Download (100vh)

**Layout:** two columns, `display: grid; grid-template-columns: 55fr 45fr; gap: 16px;` padding on all sides, full height.

### Left column — Profile preview
- Full Alex Johnson profile: avatar, header (name, handle, connect button, followers, bio), badge capsule, then the 3 demo posts
- All persona colors active (avatar ring `#759AEF`, badge circles `#759AEF`, post accent colors)
- Scrollable internally if content overflows (the column itself is `overflow-y: auto`)

### Right column — two stacked cards
Both cards have `border: 2px solid #000`, `border-radius: 24px`, `background: #fff`, `padding: 28px 32px`.

**Top card — description**
Text: *"What other subjects will see when the script finishes its first sweep of your machine. Yours will be similar. Probably worse."*
Font size: `clamp(18px, 1.8vw, 24px)`, weight 500, black.

**Bottom card — download CTA**
Two sub-columns inside the card: `display: flex; gap: 16px; align-items: center;`
- Left side (flex: 1):
  - Large label: "Download Compliant" — bold, `clamp(22px, 2.2vw, 30px)`
  - Sub-line: "Let the process begin" — medium
  - Fine print: "Compliant.dmg · macOS · zero refunds" — small, `0.75em`
- Right side (fixed ~100px square):
  - Small bordered box, `border: 2px solid #000`, `border-radius: 12px`
  - Text centered: "icon app, coming soon" — tiny, `10px`, uppercase, weight 700

---

## Screen 3 — Workflow (100vh)

**Layout:** `display: flex; flex-direction: column; justify-content: space-between;`

- Title: "workflow in 3 parts." — large black (`clamp(48px, 6vw, 90px)`), weight 800, left-aligned, `letter-spacing: -0.02em`
- 3 cards in a row (`display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;`):
  - Background: `#fff`
  - Border: `2px solid #000`
  - Content per card: step number (01/02/03, large faded black), title, body text, footer note
  - Same copy as current STEPS array

---

## Screen 4 — The 3 Personas (100vh)

**Layout:** `display: flex; flex-direction: column; justify-content: space-between;`

- Title: "the 3 personas." — same large style as Screen 3, black, left-aligned
- 3 cards in a row, same grid:
  - Card background: persona color fill (`#D8D8D8` / `#759AEF` / `#CCF847`)
  - Text: `#000`
  - Content per card: number (01/02/03), persona title, body description, footer note
  - Same copy as current PERSONAS array

---

## Screen 5 — Summary (100vh)

**Layout:** `display: flex; flex-direction: column; gap: 16px;` full height, padding on all sides.

- Title: "screen resume of everything." — same large black style as Screens 3 & 4, left-aligned, `flex-shrink: 0`
- Below title: two-column grid `display: grid; grid-template-columns: 40fr 60fr; gap: 16px;` taking remaining height (`flex: 1 1 auto; min-height: 0`)

### Left column — Profile header card
- Bordered card (`border: 2px solid #000`, `border-radius: 24px`, `padding: 24px`)
- Contains only the profile header: avatar, name, handle, connect button, followers row, bio, badge capsule
- **No posts**
- Persona colors active (avatar ring, badge circles)

### Right column — 3-row grid
`display: grid; grid-template-rows: 1fr 1fr auto; gap: 12px;` filling full height.

**Row 1 — Mini workflow cards**
3 cards in a row (`grid-template-columns: repeat(3, 1fr); gap: 12px`):
- White bg, black border, smaller padding
- Number + step title only (body text omitted at this scale)

**Row 2 — Mini persona cards**
3 cards in a row, same structure:
- Persona color fill, black text
- Number + persona title only

**Row 3 — Download row**
`display: flex; gap: 12px; align-items: stretch;`
- Left: bordered card (flex: 1) with "Download Compliant / Let the process begin / Compliant.dmg · macOS · zero refunds"
- Right: small square placeholder "icon app, coming soon"

---

## Files to Rewrite

| File | Action |
|---|---|
| `src/landing-page/LandingPage.jsx` | Full rewrite |
| `src/landing-page/landingPage.css` | Full rewrite |

No other files change. `PostCard.jsx`, profile component classes, and base design tokens are untouched.

## What Does NOT Change

- `PostCard` component and its CSS
- Profile component classes (`.profile-hero-capsule`, `.profile-badge-capsule`, etc.)
- `DEMO_POSTS`, `STEPS`, `PERSONAS` data arrays — same copy, same structure
- `timeToCreatedAt` helper
- `onEnterDemo` callback wire-up (debug button + secondary CTA)
- Base design tokens in `src/styles/base.css`
