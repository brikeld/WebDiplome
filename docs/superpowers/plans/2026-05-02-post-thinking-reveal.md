# Post Thinking Layer Reveal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a horizontal drag/swipe gesture to each post card that physically reveals a terminal-style "thinking layer" underneath, snapping open past 50% drag and snapping back otherwise.

**Architecture:** A new `DraggablePostCard` wrapper component stacks a fixed `ThinkingLayer` behind the existing `PostCard`, which slides right via `translateX` as the user drags. `PostsTab` switches from `PostCard` to `DraggablePostCard` and injects placeholder `thinking` strings per post. Drag physics (resistance curve, spring snap) live entirely in the wrapper; `PostCard` is untouched.

**Tech Stack:** React 18 (hooks: `useRef`, `useState`, `useCallback`), CSS custom properties + transitions, pointer events API (covers mouse + touch uniformly).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/features/feed/DraggablePostCard.jsx` | Drag state, pointer events, reveal wrapper, ThinkingLayer render |
| Create | `src/styles/postThinking.css` | Thinking layer visual: dark bg, terminal font, scanlines, segment fade-in |
| Modify | `src/styles.css` | Import `postThinking.css` |
| Modify | `src/features/feed/PostsTab.jsx` | Use `DraggablePostCard`, inject placeholder `thinking` per post |

---

### Task 1: Add `postThinking.css` with all thinking-layer styles

**Files:**
- Create: `src/styles/postThinking.css`

- [ ] **Step 1: Create the CSS file**

```css
/* ── POST THINKING LAYER ── */

/* Outer wrapper: clips the sliding card and holds the thinking layer */
.post-reveal-wrapper {
  position: relative;
  overflow: hidden;
  /* Match the post-card shape so nothing bleeds out */
  border-radius: 9999px;
  /* Needs explicit height so the thinking layer fills the same space */
  isolation: isolate;
}

/* Thinking layer sits below the sliding card at all times */
.thinking-layer {
  position: absolute;
  inset: 0;
  background: #0d0d0d;
  border-radius: 9999px;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 10px 28px 10px 10px;
  box-sizing: border-box;
  /* Subtle horizontal scanlines */
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.18) 3px,
    rgba(0, 0, 0, 0.18) 4px
  );
}

/* Scrollable inner container for the text content */
.thinking-layer-inner {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  position: relative;
  z-index: 1; /* above scanlines bg-image */
}

/* Each fragment of the thinking text */
.thinking-segment {
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  color: #b0ff6e;
  letter-spacing: 0.01em;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.12s ease, transform 0.12s ease;
  white-space: pre-wrap;
  word-break: break-word;
}

.thinking-segment.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Tap-to-close hint shown when fully open */
.thinking-close-hint {
  position: absolute;
  bottom: 14px;
  right: 20px;
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 10px;
  color: #4ade80;
  opacity: 0.55;
  letter-spacing: 0.05em;
  pointer-events: none;
  user-select: none;
}

/* The post card itself — draggable top layer */
.post-reveal-card {
  position: relative;
  z-index: 2;
  /* transition only applied when NOT actively dragging */
  will-change: transform;
  touch-action: pan-y; /* allow vertical scroll, capture horizontal */
  cursor: grab;
}

.post-reveal-card.is-dragging {
  cursor: grabbing;
  transition: none;
}

.post-reveal-card.is-snapping {
  transition: transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.post-reveal-card.is-snapping-back {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* When post is fully open, clicking the thinking layer should be obvious */
.thinking-layer.is-open {
  cursor: pointer;
}
```

- [ ] **Step 2: Import the new CSS in `src/styles.css`**

Open `src/styles.css` and add the import at the end:

```css
/* App styles — split across `src/styles/`: base (shared), home, profile. */
@import './styles/base.css';
@import './styles/home.css';
@import './styles/profile.css';
@import './features/profile/ProfileOverview/profileOverview.css';
@import './styles/postThinking.css';
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/postThinking.css src/styles.css
git commit -m "feat: add post thinking layer CSS (terminal dark, scanlines, segment fade)"
```

---

### Task 2: Create `DraggablePostCard` component

**Files:**
- Create: `src/features/feed/DraggablePostCard.jsx`

The component manages drag state via `useRef` (no re-render during drag) and only calls `setState` on snap (open/close). The resistance curve is `offset = Math.max(0, rawDx) * (1 - Math.max(0, rawDx) / (cardWidth * 2.5))`. Segments are revealed based on `dragPct = offset / cardWidth`.

Thresholds for 6 segments:
- Segment 0 visible at `dragPct >= 0.08`
- Segment 1 visible at `dragPct >= 0.20`
- Segment 2 visible at `dragPct >= 0.34`
- Segment 3 visible at `dragPct >= 0.50`
- Segment 4 visible at `dragPct >= 0.68`
- Segment 5 visible at `dragPct >= 0.85`

- [ ] **Step 1: Create the component**

```jsx
import { useRef, useState, useCallback, useEffect } from 'react';
import PostCard from './PostCard.jsx';

const SNAP_THRESHOLD = 0.50; // fraction of card width
const RESISTANCE = 2.5;       // higher = more resistance
const SEGMENT_THRESHOLDS = [0.08, 0.20, 0.34, 0.50, 0.68, 0.85];

function splitThinking(text) {
  // Split into ~6 roughly equal chunks at sentence or clause boundaries
  if (!text) return ['...'];
  const sentences = text.match(/[^.!?…]+[.!?…]*/g) ?? [text];
  const chunks = [];
  const perChunk = Math.ceil(sentences.length / 6);
  for (let i = 0; i < sentences.length; i += perChunk) {
    chunks.push(sentences.slice(i, i + perChunk).join(' ').trim());
  }
  // Pad or truncate to exactly 6
  while (chunks.length < 6) chunks.push('');
  return chunks.slice(0, 6);
}

export default function DraggablePostCard({ post }) {
  const wrapperRef = useRef(null);
  const cardRef = useRef(null);
  const dragState = useRef({ active: false, startX: 0, currentOffset: 0 });
  const animFrameRef = useRef(null);

  const [snapState, setSnapState] = useState('idle'); // 'idle' | 'open' | 'snapping' | 'snapping-back'
  const [dragOffset, setDragOffset] = useState(0);
  const [visibleSegments, setVisibleSegments] = useState(0);

  const isOpen = snapState === 'open';
  const segments = splitThinking(post.thinking ?? '');

  const getCardWidth = useCallback(() => {
    return wrapperRef.current?.offsetWidth ?? 400;
  }, []);

  const applyOffset = useCallback((rawDx) => {
    const cardWidth = getCardWidth();
    const clamped = Math.max(0, rawDx);
    const offset = clamped * (1 - clamped / (cardWidth * RESISTANCE));
    const bounded = Math.max(0, Math.min(offset, cardWidth));
    const dragPct = bounded / cardWidth;

    dragState.current.currentOffset = bounded;

    // Count visible segments
    const visible = SEGMENT_THRESHOLDS.filter(t => dragPct >= t).length;

    setDragOffset(bounded);
    setVisibleSegments(visible);
  }, [getCardWidth]);

  const snapOpen = useCallback(() => {
    const cardWidth = getCardWidth();
    setSnapState('snapping');
    setDragOffset(cardWidth);
    setVisibleSegments(6);
    // After transition ends, mark as open
    setTimeout(() => setSnapState('open'), 450);
  }, [getCardWidth]);

  const snapBack = useCallback(() => {
    setSnapState('snapping-back');
    setDragOffset(0);
    setVisibleSegments(0);
    setTimeout(() => setSnapState('idle'), 320);
  }, []);

  const onPointerDown = useCallback((e) => {
    if (isOpen) return;
    // Only horizontal drags; ignore right-clicks
    if (e.button !== undefined && e.button !== 0) return;
    dragState.current = { active: true, startX: e.clientX ?? e.touches?.[0]?.clientX, currentOffset: 0 };
    setSnapState('idle');
    cardRef.current?.setPointerCapture?.(e.pointerId);
  }, [isOpen]);

  const onPointerMove = useCallback((e) => {
    if (!dragState.current.active) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const rawDx = clientX - dragState.current.startX;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => applyOffset(rawDx));
  }, [applyOffset]);

  const onPointerUp = useCallback(() => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const cardWidth = getCardWidth();
    const pct = dragState.current.currentOffset / cardWidth;
    if (pct >= SNAP_THRESHOLD) {
      snapOpen();
    } else {
      snapBack();
    }
  }, [getCardWidth, snapOpen, snapBack]);

  // Close when clicking the thinking layer while open
  const onThinkingClick = useCallback(() => {
    if (isOpen) snapBack();
  }, [isOpen, snapBack]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const isDragging = dragState.current.active;
  const cardClassName = [
    'post-reveal-card',
    isDragging ? 'is-dragging' : '',
    snapState === 'snapping' ? 'is-snapping' : '',
    snapState === 'snapping-back' ? 'is-snapping-back' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={wrapperRef} className="post-reveal-wrapper">
      {/* Thinking layer — always rendered, always below */}
      <div
        className={`thinking-layer${isOpen ? ' is-open' : ''}`}
        onClick={onThinkingClick}
        aria-hidden={!isOpen}
      >
        <div className="thinking-layer-inner">
          {segments.map((seg, i) => (
            <span
              key={i}
              className={`thinking-segment${i < visibleSegments ? ' is-visible' : ''}`}
            >
              {seg}
            </span>
          ))}
        </div>
        {isOpen && <span className="thinking-close-hint">← swipe to close</span>}
      </div>

      {/* Post card — slides right */}
      <div
        ref={cardRef}
        className={cardClassName}
        style={{ transform: `translateX(${dragOffset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <PostCard post={post} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/feed/DraggablePostCard.jsx
git commit -m "feat: add DraggablePostCard with drag-reveal physics and thinking layer"
```

---

### Task 3: Wire `DraggablePostCard` into `PostsTab` with placeholder thinking text

**Files:**
- Modify: `src/features/feed/PostsTab.jsx`

- [ ] **Step 1: Replace `PostCard` import with `DraggablePostCard` and add placeholder thinking strings**

Replace the full contents of `src/features/feed/PostsTab.jsx` with:

```jsx
import { useMemo } from 'react';
import DraggablePostCard from './DraggablePostCard.jsx';
import { sanitizePostContent } from '@/lib/postContent.js';
import { displayNameFromProfile, initialsFromProfile } from '@/lib/profileUtils.js';

const PERSONA_COLORS = {
  productivite: '#2323FF',
  securite: '#FF4E00',
  popularite: '#0FA020',
};

const API_ORIGIN = 'http://localhost:3001';

function resolveAttachment(img) {
  if (!img || typeof img !== 'object') return null;
  const url = img.url ?? img.imageUrl ?? img.image_url ?? null;
  if (!url) return null;
  const absolute = /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`;
  return { url: absolute, filename: img.filename ?? '' };
}

// Placeholder thinking traces — one per persona. Real AI-generated values replace these later.
const PLACEHOLDER_THINKING = {
  productivite: "okay so... 3 jsx files open, figma tab, shell history full of npm run dev. something isn't compiling right. cursor + claude both active — ai-assisted dev, deadline behavior. productivity axis: is this competence or overwhelm? both. the chaos framing gets more engagement. going with self-aware builder voice. +4% productivity feels right.",
  securite: "hmm. VPN on, incognito tab, two-factor prompt dismissed twice. that's avoidance, not security hygiene. signal: aware of the risk, choosing convenience. security score delta is negative but small — passive exposure, not active breach. frame as a nudge not an alarm. don't moralize. cold factual tone.",
  popularite: "checked notifications 4 times in 8 minutes. likes pattern: responds within 90s to comments. follower growth is flat but engagement rate is healthy — this is a micro-influence plateau. frame as: reach is the bottleneck, not resonance. social persona +3% sounds right given the engagement numbers.",
};

function placeholderThinking(persona) {
  const key = String(persona ?? '').toLowerCase();
  return PLACEHOLDER_THINKING[key] ?? PLACEHOLDER_THINKING.productivite;
}

export default function PostsTab({ profile, feedContext = 'home' }) {
  const posts = useMemo(() => {
    if (!profile) return [];
    const raw = profile.personaPosts ?? [];
    const displayName = displayNameFromProfile(profile);
    const avatarInitials = initialsFromProfile(profile);
    const handle = profile?.machineName ? `@${profile.machineName}` : '@—';
    const avatarSrc =
      profile?.wallpaperBase64 ??
      profile?.wallpaper_base64 ??
      profile?.wallpaperUrl ??
      profile?.wallpaper_url ??
      profile?.wallpaper ??
      null;

    const stablePct = (seed) => {
      let h = 0;
      for (let i = 0; i < seed.length; i += 1) {
        h = (h * 31 + seed.charCodeAt(i)) >>> 0;
      }
      return (h % 5) + 1;
    };

    const createdAtFallback = (i) => Date.now() - (i + 1) * 6 * 60 * 60 * 1000;

    return raw.map((p, i) => ({
      id: i,
      persona: p.persona,
      content: sanitizePostContent(p.content),
      noteColor: PERSONA_COLORS[p.persona] ?? '#2323FF',
      displayName,
      handle,
      avatarInitials,
      avatarSrc,
      createdAt:
        p?.createdAt ??
        p?.created_at ??
        p?.created ??
        p?.timestamp ??
        p?.time ??
        createdAtFallback(i),
      systemDeltaPct: stablePct(`${p?.persona ?? ''}|${p?.content ?? ''}|${i}`),
      attachment: resolveAttachment(p.attachedImage ?? p.attached_image),
      thinking: p.thinking ?? placeholderThinking(p.persona),
    }));
  }, [profile]);

  const list = (
    <div className={`posts-tab${feedContext === 'profile' ? ' posts-tab--profile-inline' : ''}`}>
      {posts.map((p) => (
        <DraggablePostCard key={p.id} post={p} />
      ))}
    </div>
  );

  if (feedContext === 'profile') return list;

  return <div className="posts-capsule">{list}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/feed/PostsTab.jsx
git commit -m "feat: wire DraggablePostCard into PostsTab with placeholder thinking text"
```

---

### Task 4: Fix `post-reveal-wrapper` height so the thinking layer matches the card

The wrapper needs an explicit height to let the absolutely-positioned thinking layer fill the same space as the post card. Without this the thinking layer collapses to 0 height.

**Files:**
- Modify: `src/styles/postThinking.css`

- [ ] **Step 1: Add height passthrough to wrapper**

The wrapper must not have `overflow: hidden` on the `border-radius` during drag (it would clip the card at the wrapper edge). The rounded clipping is handled by the card and thinking layer individually. Update `.post-reveal-wrapper`:

```css
.post-reveal-wrapper {
  position: relative;
  /* No overflow:hidden here — the card slides outside the wrapper bounds during drag.
     Each child clips itself. The thinking layer fills the wrapper's intrinsic height. */
  isolation: isolate;
}
```

And update `.thinking-layer` to always match the wrapper's rendered height:

```css
.thinking-layer {
  position: absolute;
  inset: 0;
  background: #0d0d0d;
  border-radius: 9999px;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 10px 28px 10px 10px;
  box-sizing: border-box;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.18) 3px,
    rgba(0, 0, 0, 0.18) 4px
  );
}
```

The wrapper height is implicitly the height of `.post-reveal-card` (its only in-flow child), so the absolute `.thinking-layer` fills that space exactly.

- [ ] **Step 2: Commit**

```bash
git add src/styles/postThinking.css
git commit -m "fix: remove wrapper overflow:hidden so card can slide fully during drag"
```

---

### Task 5: Verify the full interaction in-browser

**No code changes in this task — verification only.**

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

Open the app in a browser at the printed localhost URL.

- [ ] **Step 2: Test desktop drag (golden path)**

1. Hover over a post card — cursor should be `grab`.
2. Click and drag right slowly — card should slide right with resistance; thinking text fragments should appear progressively.
3. Release before 50% — card should snap back smoothly.
4. Drag past 50% and release — card should snap fully open with a slight bounce.
5. Click the dark thinking area — card should snap back.

- [ ] **Step 3: Test mobile swipe (or simulated in DevTools)**

Open DevTools → toggle device toolbar → pick a mobile preset.
1. Swipe right on a post — same behavior as desktop.
2. Swipe left on an open post — no crash, thinking layer stays (close-hint shown, tap to close).

- [ ] **Step 4: Test vertical scroll is unaffected**

With the feed in home mode (viewport-locked scroll): scroll vertically through posts — dragging vertically should not trigger the horizontal reveal.

- [ ] **Step 5: Check edge cases**

- Post with attachment: the composite card (`post-composite` wrapper) should also drag cleanly.
- Rapidly drag and release multiple times — no stale transition class should lock the card.
- Resize browser window while a card is open — card should remain open at correct position (it's `translateX(cardWidth)` which auto-adjusts via `getCardWidth()` only on pointer events, not on resize; this is acceptable for now).

- [ ] **Step 6: Final commit if any micro-fixes were made**

```bash
git add -p
git commit -m "fix: post thinking layer polish after browser verification"
```

---

## Self-Review

**Spec coverage:**
- ✅ Left-to-right drag reveals thinking layer underneath
- ✅ Weighted/physical feel — resistance curve + different snap cubics for open vs close
- ✅ Progressive text reveal via segment thresholds
- ✅ Terminal visual: `#0d0d0d` bg, `#b0ff6e` monospace text, scanline overlay
- ✅ Snap open past 50%, snap back before 50%
- ✅ Mobile swipe (pointer events API covers touch), desktop click-and-drag
- ✅ Placeholder thinking text per persona
- ✅ Real `thinking` field falls through from post data when AI-generated values arrive later

**Placeholder scan:** None found — all steps contain actual code.

**Type consistency:**
- `splitThinking` → returns `string[]` of length 6 → consumed by `segments.map(...)` ✓
- `dragState.current.currentOffset` set in `applyOffset`, read in `onPointerUp` ✓
- `snapState` values: `'idle' | 'open' | 'snapping' | 'snapping-back'` — used consistently across `setSnapState`, `cardClassName`, and `onThinkingClick` ✓
- `post.thinking` injected in `PostsTab`, consumed in `DraggablePostCard` via `post.thinking ?? ''` ✓
