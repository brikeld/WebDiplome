# Commenting Capsule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated per-post commenting capsule (icon toggle → expanding capsule with three mock comments and a suggestion row that morphs the chosen card into a user comment), all isolated in a new `src/features/commenting/` folder.

**Architecture:** A single open-comments tracker in `PostsTab.jsx` enforces "only one capsule open at a time." `PostCard.jsx` returns a fragment of `<article>` + `<CommentsCapsule>` so the capsule is a layout-sibling of the post card and the toggle icon can FLIP-animate between meta row and the gap above the capsule without being clipped by the article boundary. All mock data is deterministic (`commentingMock.js`) — derived from `postId` so it's stable across renders. Animation reuses the existing easing `cubic-bezier(0.22, 1, 0.36, 1)` already used by `post-feed-enter` in `base.css`.

**Tech Stack:** React 18, plain CSS, Vitest for the mock module. No new dependencies.

---

## File Structure

**Create:**
- `src/features/commenting/CommentsToggle.jsx` — the icon button + FLIP animation owner
- `src/features/commenting/CommentsCapsule.jsx` — orchestrator: comments + suggestion row + user comment + open/close animation
- `src/features/commenting/Comment.jsx` — single mock comment (avatar + bubble + sub-pills)
- `src/features/commenting/UserComment.jsx` — user comment (same look as `Comment`, runs FLIP-in animation)
- `src/features/commenting/SuggestionRow.jsx` — avatar + 3 suggestion cards with +N badges
- `src/features/commenting/commentingMock.js` — deterministic mock data keyed by postId
- `src/styles/commenting.css` — all styles + keyframes for the feature
- `tests/commentingMock.test.js` — Vitest tests for the pure mock module

**Modify:**
- `src/features/feed/PostCard.jsx` — replace `<PostActions />` with `<CommentsToggle />`, return fragment with `<CommentsCapsule />`
- `src/features/feed/PostsTab.jsx` — add `openCommentsPostId` state, thread props to `PostCard`
- `src/main.jsx` — import the new CSS file (single global import)

**Delete:**
- `src/features/feed/PostActions.jsx` — only referenced by `PostCard`; superseded by `CommentsToggle`

---

## Task 1: Deterministic mock data module + tests

**Files:**
- Create: `src/features/commenting/commentingMock.js`
- Test: `tests/commentingMock.test.js`

- [ ] **Step 1.1: Write the failing tests**

Create `tests/commentingMock.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { getMockCommentsFor } from '../src/features/commenting/commentingMock.js';

describe('getMockCommentsFor', () => {
  it('returns three comments, one per persona in fixed order', () => {
    const { comments } = getMockCommentsFor('post-abc');
    expect(comments).toHaveLength(3);
    expect(comments.map((c) => c.persona)).toEqual([
      'productivite',
      'securite',
      'popularite',
    ]);
  });

  it('returns three suggestions, one per persona in fixed order', () => {
    const { suggestions } = getMockCommentsFor('post-abc');
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((s) => s.persona)).toEqual([
      'productivite',
      'securite',
      'popularite',
    ]);
  });

  it('every comment has a non-empty content string and three pill labels', () => {
    const { comments } = getMockCommentsFor('post-abc');
    for (const c of comments) {
      expect(typeof c.content).toBe('string');
      expect(c.content.length).toBeGreaterThan(0);
      expect(c.pills).toHaveLength(3);
      for (const p of c.pills) {
        expect(typeof p).toBe('string');
        expect(p.length).toBeGreaterThan(0);
      }
    }
  });

  it('every suggestion has content and a plusValue between 1 and 5', () => {
    const { suggestions } = getMockCommentsFor('post-abc');
    for (const s of suggestions) {
      expect(typeof s.content).toBe('string');
      expect(s.content.length).toBeGreaterThan(0);
      expect(Number.isInteger(s.plusValue)).toBe(true);
      expect(s.plusValue).toBeGreaterThanOrEqual(1);
      expect(s.plusValue).toBeLessThanOrEqual(5);
    }
  });

  it('is deterministic: same postId yields identical data on repeated calls', () => {
    const a = getMockCommentsFor('post-xyz');
    const b = getMockCommentsFor('post-xyz');
    expect(a).toEqual(b);
  });

  it('different postIds yield different plusValue sequences for at least some inputs', () => {
    const samples = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) =>
      getMockCommentsFor(id).suggestions.map((s) => s.plusValue).join(','),
    );
    const unique = new Set(samples);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('accepts numeric postId by coercing to string', () => {
    const a = getMockCommentsFor(42);
    const b = getMockCommentsFor('42');
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `npm test -- commentingMock`
Expected: All tests fail — module does not exist yet.

- [ ] **Step 1.3: Implement `commentingMock.js`**

Create `src/features/commenting/commentingMock.js`:

```javascript
const PERSONA_ORDER = ['productivite', 'securite', 'popularite'];

const COMMENT_BANK = {
  productivite: [
    'Solid throughput this cycle — the cadence is paying off in shipped surface area.',
    'You\'re sequencing the work well; the dependency chain looks healthier than last month.',
    'Heads-down output is up, but make sure you\'re leaving room for review passes.',
    'Eighty edits in a week — that\'s a meaningful slope. Keep the streak honest.',
    'The pace is great. Worth tagging the riskiest changes so they get a second pair of eyes.',
  ],
  securite: [
    'Worth double-checking that none of the new endpoints are exposed without auth.',
    'High commit volume is also high blast radius — keep the rollback story tight.',
    'Make sure secrets aren\'t leaking into the recent diffs. Quick scan recommended.',
    'Security hygiene at this velocity matters: pin dependencies and review additions.',
    'Audit log coverage should grow with the surface area you\'re shipping.',
  ],
  popularite: [
    'People are noticing. The cadence reads as confident in public.',
    'You\'ve built a quiet streak — share a snippet and the network will compound.',
    'This is the kind of work that gets quoted later. Let it breathe in public.',
    'Eighty changes is a story in itself. Worth posting the highlight reel.',
    'The momentum is visible. A short retro post would land well right now.',
  ],
};

const PILL_BANK = ['text', 'text', 'text', 'text', 'text', 'text'];

const SUGGESTION_BANK = {
  productivite: [
    'Strong cadence — keep the queue moving and protect the focus blocks.',
    'Try batching the small edits so the big ones get the attention they need.',
    'Lock in the streak with a short Friday review of what shipped.',
    'The pace is sustainable if you keep the review loop short.',
  ],
  securite: [
    'Run a quick secrets scan over the diff before tagging the release.',
    'Tighten the rollback plan now while the changes are still fresh.',
    'Add a smoke test for the riskiest path so a regression catches itself.',
    'Pin the new deps before they drift on you.',
  ],
  popularite: [
    'Share a one-line summary of the week — small post, big compounding.',
    'A short video of the new flow would land well right now.',
    'Tag the people who unblocked you — quiet credit travels far.',
    'Drop a snippet, watch the network do the rest.',
  ],
};

function hash(str) {
  const s = String(str);
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick(bank, seed) {
  return bank[seed % bank.length];
}

export function getMockCommentsFor(postId) {
  const base = hash(postId);

  const comments = PERSONA_ORDER.map((persona, i) => {
    const seed = hash(`${postId}|comment|${persona}|${i}`);
    return {
      persona,
      content: pick(COMMENT_BANK[persona], seed),
      pills: [
        pick(PILL_BANK, seed + 1),
        pick(PILL_BANK, seed + 2),
        pick(PILL_BANK, seed + 3),
      ],
    };
  });

  const suggestions = PERSONA_ORDER.map((persona, i) => {
    const seed = hash(`${postId}|suggestion|${persona}|${i}`);
    return {
      persona,
      content: pick(SUGGESTION_BANK[persona], seed),
      plusValue: ((seed + base) % 5) + 1,
    };
  });

  return { comments, suggestions };
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `npm test -- commentingMock`
Expected: All 7 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/features/commenting/commentingMock.js tests/commentingMock.test.js
git commit -m "feat(commenting): add deterministic mock comment + suggestion data"
```

---

## Task 2: Static comment components (no interactivity yet)

**Files:**
- Create: `src/features/commenting/Comment.jsx`
- Create: `src/features/commenting/UserComment.jsx`
- Create: `src/features/commenting/SuggestionRow.jsx`
- Create: `src/styles/commenting.css`

- [ ] **Step 2.1: Create `commenting.css` with base styles**

Create `src/styles/commenting.css`:

```css
/* ── Commenting capsule ────────────────────────────────────────────────────
   Per-post commenting UI. Lives below each PostCard as a layout sibling
   so the toggle icon can animate between the meta row and the capsule.
   ─────────────────────────────────────────────────────────────────────── */

:root {
  --commenting-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --commenting-duration: 280ms;
  --commenting-stagger: 60ms;
  --commenting-persona-productivite: #D8D8D8;
  --commenting-persona-securite: #759AEF;
  --commenting-persona-popularite: #CCF847;
}

/* Capsule shell (collapsed by default; open class on parent or self) */
.commenting-capsule {
  box-sizing: border-box;
  width: 92%;
  margin: 0 auto;
  border: 1.5px solid var(--ink, #fff);
  border-radius: var(--radius-post-surface, 22px);
  background: transparent;
  padding: 16px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  opacity: 0;
  max-height: 0;
  transform: translateY(-4px);
  transition:
    max-height var(--commenting-duration) var(--commenting-ease),
    opacity var(--commenting-duration) var(--commenting-ease),
    transform var(--commenting-duration) var(--commenting-ease),
    padding var(--commenting-duration) var(--commenting-ease);
  padding-top: 0;
  padding-bottom: 0;
}

.commenting-capsule--open {
  opacity: 1;
  transform: translateY(0);
  padding-top: 16px;
  padding-bottom: 12px;
  /* max-height set inline at runtime to measured scrollHeight */
}

/* Single comment row */
.commenting-comment {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  align-items: start;
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity var(--commenting-duration) var(--commenting-ease),
    transform var(--commenting-duration) var(--commenting-ease);
}

.commenting-capsule--open .commenting-comment {
  opacity: 1;
  transform: translateY(0);
}

.commenting-comment-avatar {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;
  background: var(--post-accent, #444);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.commenting-comment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.commenting-comment-bubble {
  border: 1.5px solid var(--comment-accent, var(--ink, #fff));
  border-radius: var(--radius-post-surface, 22px);
  padding: 12px 16px 10px;
  background: transparent;
  color: var(--comment-accent, var(--ink, #fff));
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.commenting-comment-content {
  font-family: var(--font-sans, inherit);
  font-size: 14px;
  line-height: 1.35;
  font-weight: 700;
  margin: 0;
}

.commenting-comment-byline {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.commenting-comment-name {
  font-family: 'AvantGarde ITC BT', var(--font-sans, inherit);
  font-size: 13px;
  font-weight: 700;
  margin: 0;
  color: var(--comment-accent, var(--ink, #fff));
}

.commenting-comment-handle {
  font-family: var(--font-sans, inherit);
  font-size: 12px;
  font-style: italic;
  margin: 0;
  color: var(--comment-accent, var(--ink, #fff));
  opacity: 0.85;
}

/* Sub-pills under each comment bubble */
.commenting-comment-pills {
  grid-column: 2;
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.commenting-comment-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px 4px;
  border-radius: 9999px;
  border: 1.5px solid var(--comment-accent, var(--ink, #fff));
  background: transparent;
  color: var(--comment-accent, var(--ink, #fff));
  font-family: var(--font-sans, inherit);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

/* Suggestion row */
.commenting-suggestion-row {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  align-items: stretch;
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity var(--commenting-duration) var(--commenting-ease),
    transform var(--commenting-duration) var(--commenting-ease),
    max-height var(--commenting-duration) var(--commenting-ease);
  max-height: 180px;
  overflow: hidden;
}

.commenting-capsule--open .commenting-suggestion-row {
  opacity: 1;
  transform: translateY(0);
}

.commenting-suggestion-row--collapsed {
  opacity: 0;
  max-height: 0;
  pointer-events: none;
}

.commenting-suggestion-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.commenting-suggestion-card {
  appearance: none;
  border: none;
  cursor: pointer;
  position: relative;
  border-radius: 14px;
  padding: 10px 38px 12px 12px;
  text-align: left;
  background: var(--suggestion-bg, #D8D8D8);
  color: var(--suggestion-fg, #000);
  font-family: var(--font-sans, inherit);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.25;
  min-height: 88px;
  display: flex;
  align-items: flex-start;
  transition:
    opacity var(--commenting-duration) var(--commenting-ease),
    transform var(--commenting-duration) var(--commenting-ease);
}

.commenting-suggestion-card[data-persona='productivite'] {
  --suggestion-bg: var(--commenting-persona-productivite);
  --suggestion-fg: #000;
}

.commenting-suggestion-card[data-persona='securite'] {
  --suggestion-bg: var(--commenting-persona-securite);
  --suggestion-fg: #fff;
}

.commenting-suggestion-card[data-persona='popularite'] {
  --suggestion-bg: var(--commenting-persona-popularite);
  --suggestion-fg: #000;
}

.commenting-suggestion-card--faded {
  opacity: 0;
  pointer-events: none;
}

.commenting-suggestion-card__plus {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  background: #0c0c0c;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  transition: opacity var(--commenting-duration) var(--commenting-ease);
}

.commenting-suggestion-card__plus--hidden {
  opacity: 0;
}

/* Footer "comment here" pill */
.commenting-footer {
  display: flex;
  justify-content: center;
  padding: 4px 0 0;
}

.commenting-footer-pill {
  width: 100%;
  text-align: center;
  border: 1.5px solid var(--ink, #fff);
  border-radius: 9999px;
  padding: 10px 16px;
  font-family: 'AvantGarde ITC BT', var(--font-sans, inherit);
  font-size: 14px;
  font-weight: 600;
  color: var(--ink, #fff);
  background: transparent;
}

/* Comment toggle icon — animated wrapper holds the original icon button */
.commenting-toggle-host {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Hosts the post-action-btn so we can apply transforms to a single element */
  pointer-events: auto;
}

.commenting-toggle-host--open {
  /* Transform applied at runtime via inline style for FLIP */
}
```

- [ ] **Step 2.2: Create `Comment.jsx`**

Create `src/features/commenting/Comment.jsx`:

```jsx
const PERSONA_COLORS = {
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

export default function Comment({
  persona,
  content,
  pills,
  displayName,
  handle,
  avatarSrc,
  avatarInitials,
  staggerIndex = 0,
}) {
  const accent = PERSONA_COLORS[persona] ?? '#fff';
  return (
    <div
      className="commenting-comment"
      data-persona={persona}
      style={{
        '--comment-accent': accent,
        transitionDelay: `${staggerIndex * 60}ms`,
      }}
    >
      <div className="commenting-comment-avatar" aria-hidden>
        {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{avatarInitials}</span>}
      </div>
      <div className="commenting-comment-bubble">
        <p className="commenting-comment-content">{content}</p>
        <div className="commenting-comment-byline">
          <p className="commenting-comment-name">{displayName}</p>
          {handle ? <p className="commenting-comment-handle">{handle}</p> : null}
        </div>
      </div>
      <div className="commenting-comment-pills" aria-hidden>
        {pills.map((label, i) => (
          <span key={i} className="commenting-comment-pill">{label}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2.3: Create `UserComment.jsx`**

Create `src/features/commenting/UserComment.jsx`:

```jsx
import Comment from './Comment.jsx';

export default function UserComment({
  persona,
  content,
  displayName,
  handle,
  avatarSrc,
  avatarInitials,
}) {
  return (
    <Comment
      persona={persona}
      content={content}
      pills={['text', 'text', 'text']}
      displayName={displayName}
      handle={handle}
      avatarSrc={avatarSrc}
      avatarInitials={avatarInitials}
      staggerIndex={0}
    />
  );
}
```

- [ ] **Step 2.4: Create `SuggestionRow.jsx`**

Create `src/features/commenting/SuggestionRow.jsx`:

```jsx
export default function SuggestionRow({
  suggestions,
  avatarSrc,
  avatarInitials,
  pickedPersona = null,
  collapsed = false,
  onPick,
}) {
  return (
    <div
      className={`commenting-suggestion-row${collapsed ? ' commenting-suggestion-row--collapsed' : ''}`}
    >
      <div className="commenting-comment-avatar" aria-hidden>
        {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{avatarInitials}</span>}
      </div>
      <div className="commenting-suggestion-cards">
        {suggestions.map((s) => {
          const isPicked = pickedPersona === s.persona;
          const isFaded = pickedPersona !== null && !isPicked;
          return (
            <button
              key={s.persona}
              type="button"
              className={`commenting-suggestion-card${isFaded ? ' commenting-suggestion-card--faded' : ''}`}
              data-persona={s.persona}
              data-suggestion-card={s.persona}
              onClick={() => onPick?.(s)}
              disabled={pickedPersona !== null}
            >
              <span>{s.content}</span>
              <span
                className={`commenting-suggestion-card__plus${isPicked ? ' commenting-suggestion-card__plus--hidden' : ''}`}
                aria-hidden
              >
                +{s.plusValue}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2.5: Commit**

```bash
git add src/features/commenting/Comment.jsx src/features/commenting/UserComment.jsx src/features/commenting/SuggestionRow.jsx src/styles/commenting.css
git commit -m "feat(commenting): add static Comment, UserComment, SuggestionRow + base CSS"
```

---

## Task 3: CommentsToggle + CommentsCapsule (state, no animations yet)

**Files:**
- Create: `src/features/commenting/CommentsToggle.jsx`
- Create: `src/features/commenting/CommentsCapsule.jsx`

- [ ] **Step 3.1: Create `CommentsToggle.jsx`**

This file reuses the SVG icon from the existing `PostActions.jsx` so the visual is identical, and adds open/close behavior plus an `aria-expanded` attribute.

Create `src/features/commenting/CommentsToggle.jsx`:

```jsx
import { forwardRef } from 'react';

const CommentsToggle = forwardRef(function CommentsToggle(
  { isOpen, onToggle, controlsId },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`post-meta-pill post-action-btn post-action-btn--comment commenting-toggle-host${isOpen ? ' commenting-toggle-host--open' : ''}`}
      aria-label={isOpen ? 'Close comments' : 'Open comments'}
      aria-expanded={isOpen}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5l-3.7 2.8A.6.6 0 0 1 5 17.4V15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      </svg>
    </button>
  );
});

export default CommentsToggle;
```

- [ ] **Step 3.2: Create `CommentsCapsule.jsx`**

Create `src/features/commenting/CommentsCapsule.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import Comment from './Comment.jsx';
import UserComment from './UserComment.jsx';
import SuggestionRow from './SuggestionRow.jsx';
import { getMockCommentsFor } from './commentingMock.js';

export default function CommentsCapsule({
  post,
  isOpen,
  capsuleId,
  displayName,
  handle,
  avatarSrc,
  avatarInitials,
}) {
  const [picked, setPicked] = useState(null);
  const rootRef = useRef(null);

  // Reset pick state whenever capsule closes
  useEffect(() => {
    if (!isOpen) setPicked(null);
  }, [isOpen]);

  // Set max-height to measured scroll height when open, 0 when closed
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (isOpen) {
      el.style.maxHeight = `${el.scrollHeight}px`;
    } else {
      el.style.maxHeight = '0px';
    }
  }, [isOpen, picked]);

  const { comments, suggestions } = getMockCommentsFor(post.id);

  return (
    <div
      ref={rootRef}
      id={capsuleId}
      className={`commenting-capsule${isOpen ? ' commenting-capsule--open' : ''}`}
      data-post-id={post.id}
      aria-hidden={!isOpen}
    >
      {comments.map((c, i) => (
        <Comment
          key={c.persona}
          persona={c.persona}
          content={c.content}
          pills={c.pills}
          displayName={displayName}
          handle={handle}
          avatarSrc={avatarSrc}
          avatarInitials={avatarInitials}
          staggerIndex={i}
        />
      ))}

      {picked ? (
        <UserComment
          persona={picked.persona}
          content={picked.content}
          displayName={displayName}
          handle={handle}
          avatarSrc={avatarSrc}
          avatarInitials={avatarInitials}
        />
      ) : null}

      <SuggestionRow
        suggestions={suggestions}
        avatarSrc={avatarSrc}
        avatarInitials={avatarInitials}
        pickedPersona={picked?.persona ?? null}
        collapsed={picked !== null}
        onPick={(s) => setPicked(s)}
      />

      <div className="commenting-footer">
        <div className="commenting-footer-pill">comment here</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.3: Commit**

```bash
git add src/features/commenting/CommentsToggle.jsx src/features/commenting/CommentsCapsule.jsx
git commit -m "feat(commenting): add CommentsToggle and CommentsCapsule orchestrator"
```

---

## Task 4: Wire into PostCard + PostsTab, delete PostActions, import CSS

**Files:**
- Modify: `src/features/feed/PostCard.jsx`
- Modify: `src/features/feed/PostsTab.jsx`
- Modify: `src/main.jsx`
- Delete: `src/features/feed/PostActions.jsx`

- [ ] **Step 4.1: Import the new CSS in `main.jsx`**

Open `src/main.jsx` and add the import alongside the existing style imports. Read the file first to find the exact location.

Run: `grep -n "styles" src/main.jsx`

Expected output: lines that import CSS files (e.g. `./styles/base.css`).

Add a new line `import './styles/commenting.css';` immediately after the last existing styles import, preserving order.

- [ ] **Step 4.2: Replace `PostsTab.jsx` to thread comments state**

Open `src/features/feed/PostsTab.jsx`. Apply two changes:

(a) At the top of the `PostsTab` component, add a state hook:

```jsx
import { useMemo, useState } from 'react';
// ...existing imports...

export default function PostsTab({ profile, feedContext = 'home', isGeneratingPosts = false }) {
  const [openCommentsPostId, setOpenCommentsPostId] = useState(null);
  // ...existing useMemo block unchanged...
```

(b) In the JSX where `<PostCard />` is rendered, pass the new props:

```jsx
{posts.map((p) => (
  <PostCard
    key={p._feedKey ?? String(p.id)}
    post={p}
    animateEnter={!!p._feedEnter}
    isCommentsOpen={openCommentsPostId === p.id}
    onToggleComments={() =>
      setOpenCommentsPostId((prev) => (prev === p.id ? null : p.id))
    }
  />
))}
```

- [ ] **Step 4.3: Replace `PostCard.jsx` to return fragment with capsule**

Open `src/features/feed/PostCard.jsx`. Apply these changes:

(a) Replace the import of `PostActions` with imports of the new components:

```jsx
import CommentsToggle from '@/features/commenting/CommentsToggle.jsx';
import CommentsCapsule from '@/features/commenting/CommentsCapsule.jsx';
```
(Remove `import PostActions from './PostActions.jsx';`.)

(b) Change the component signature to receive new props:

```jsx
export default function PostCard({
  post,
  animateEnter = false,
  isCommentsOpen = false,
  onToggleComments,
}) {
```

(c) Replace the `<PostActions />` JSX inside `.post-meta-right` with:

```jsx
<CommentsToggle
  isOpen={isCommentsOpen}
  onToggle={onToggleComments}
  controlsId={`commenting-${post.id}`}
/>
```

(d) Change the component's return so it returns a fragment containing the existing `<article>` and a sibling `<CommentsCapsule />`:

```jsx
return (
  <>
    <article
      className={`post-card${attachedAsset ? ' post-card--has-attachment' : ''}${animateEnter ? ' post-card--feed-enter' : ''}`}
      data-persona={post.persona}
      style={{ '--post-accent': noteColor }}
    >
      {/* ...existing article body unchanged... */}
    </article>
    <CommentsCapsule
      post={post}
      isOpen={isCommentsOpen}
      capsuleId={`commenting-${post.id}`}
      displayName={displayName}
      handle={handle}
      avatarSrc={avatarSrc}
      avatarInitials={avatarInitials}
    />
  </>
);
```

- [ ] **Step 4.4: Delete `PostActions.jsx`**

Run: `git rm src/features/feed/PostActions.jsx`

Then verify nothing else still references it:

Run: `grep -rn "PostActions" src/`
Expected: no output.

- [ ] **Step 4.5: Verify dev build compiles**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4.6: Manual smoke check in dev**

Run in two terminals: `npm run servers` then `npm run dev`. Open the home view in a browser. Click the comment icon on a post. Expected: the capsule expands below the post showing three mock comments (productivity gray, security blue, popularity lime), a 3-card suggestion row, and a "comment here" pill at the bottom. Clicking the comment icon on a different post closes the first and opens the second. Clicking a suggestion card replaces it with a user comment row above the (collapsed) suggestion row.

If anything is visually off (e.g. capsule clipped, sub-pills missing), stop and fix before continuing — animation tweaks come in Task 5 and Task 6.

- [ ] **Step 4.7: Commit**

```bash
git add src/features/feed/PostCard.jsx src/features/feed/PostsTab.jsx src/main.jsx
git commit -m "feat(commenting): wire CommentsToggle + CommentsCapsule into PostCard/PostsTab"
```

---

## Task 5: Toggle icon FLIP animation (icon moves between meta row and capsule overlap)

**Goal:** When the capsule opens, the comment icon (the same DOM node, not reparented) animates to a centered position sitting visually between the post-meta row and the top of the capsule. When the capsule closes, it returns.

**Approach:** Measure the icon's current bounding rect, compute a target rect (centered horizontally relative to the article, vertically offset to sit on the capsule's top edge), and apply a `transform: translate(...)` to the same DOM node. Use a layout effect so the measurement happens before paint.

**Files:**
- Modify: `src/features/feed/PostCard.jsx` (add ref + effect)
- Modify: `src/styles/commenting.css` (transition rule)

- [ ] **Step 5.1: Add transition rule for the toggle host**

In `src/styles/commenting.css`, find the existing `.commenting-toggle-host` block and replace with:

```css
.commenting-toggle-host {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  transition: transform var(--commenting-duration) var(--commenting-ease);
  will-change: transform;
}
```

- [ ] **Step 5.2: Add ref + layout effect in `PostCard.jsx`**

Add an import for `useLayoutEffect` and `useRef` at the top of `src/features/feed/PostCard.jsx`:

```jsx
import { lazy, Suspense, useLayoutEffect, useRef } from 'react';
```

Inside the `PostCard` body (before the `return`), add:

```jsx
const toggleRef = useRef(null);
const articleRef = useRef(null);

useLayoutEffect(() => {
  const btn = toggleRef.current;
  const article = articleRef.current;
  if (!btn || !article) return;

  if (!isCommentsOpen) {
    btn.style.transform = '';
    return;
  }

  // Compute translate so the button sits centered horizontally on the article,
  // vertically positioned to overlap the gap between the post and the capsule.
  const btnRect = btn.getBoundingClientRect();
  const articleRect = article.getBoundingClientRect();

  const targetX = articleRect.left + articleRect.width / 2;
  const targetY = articleRect.bottom + 4; // 4px below the article edge

  const currentX = btnRect.left + btnRect.width / 2;
  const currentY = btnRect.top + btnRect.height / 2;

  const dx = targetX - currentX;
  const dy = targetY - currentY;

  btn.style.transform = `translate(${dx}px, ${dy}px)`;
}, [isCommentsOpen]);
```

Attach the refs:

```jsx
<article
  ref={articleRef}
  className={/* ...existing... */}
  /* ...rest unchanged... */
>
```

```jsx
<CommentsToggle
  ref={toggleRef}
  isOpen={isCommentsOpen}
  onToggle={onToggleComments}
  controlsId={`commenting-${post.id}`}
/>
```

- [ ] **Step 5.3: Manual verify the icon animation**

Run: `npm run dev` (servers already running from Task 4). In the browser:
- Click a post's comment icon — the icon should slide smoothly from the meta row down to a position centered horizontally on the article and resting just above the capsule.
- Click the same icon again — it should slide back to its original position with no jump.
- Click another post's icon — first icon returns, second icon slides into position; only one icon should be in the centered position at any time.

Expected easing: smooth, ~280ms, matches the post-feed-enter feel.

If the icon jumps or ends in the wrong place, common causes: (a) the article's `getBoundingClientRect` is being read after scroll changed it — re-check that the effect runs synchronously, (b) the capsule is pushing layout during the same frame — that's fine because we recompute on every `isCommentsOpen` change.

- [ ] **Step 5.4: Commit**

```bash
git add src/features/feed/PostCard.jsx src/styles/commenting.css
git commit -m "feat(commenting): animate comment icon FLIP between meta row and capsule edge"
```

---

## Task 6: Suggestion-pick FLIP animation

**Goal:** When the user clicks a suggestion card, that card morphs (FLIP) into the position of the new `UserComment` row above the suggestion row; the other two cards fade; then the whole suggestion row collapses.

**Approach:**
1. Measure the chosen card's rect at the moment of click.
2. Set `picked` state — this causes `UserComment` to render in its final slot.
3. In a layout effect, measure the `UserComment` node's rect.
4. Apply an inverse transform to the `UserComment` node so it visually starts where the card was.
5. On the next frame, remove the transform — it animates to its natural position.
6. Simultaneously the suggestion row collapses (CSS-driven via the `--collapsed` class).

**Files:**
- Modify: `src/features/commenting/CommentsCapsule.jsx` — add FLIP measurement + transition state

- [ ] **Step 6.1: Add FLIP state and measurement in `CommentsCapsule.jsx`**

Open `src/features/commenting/CommentsCapsule.jsx` and replace it entirely with:

```jsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Comment from './Comment.jsx';
import UserComment from './UserComment.jsx';
import SuggestionRow from './SuggestionRow.jsx';
import { getMockCommentsFor } from './commentingMock.js';

export default function CommentsCapsule({
  post,
  isOpen,
  capsuleId,
  displayName,
  handle,
  avatarSrc,
  avatarInitials,
}) {
  const [picked, setPicked] = useState(null);
  const [originRect, setOriginRect] = useState(null);
  const rootRef = useRef(null);
  const userCommentRef = useRef(null);

  // Reset pick state when capsule closes
  useEffect(() => {
    if (!isOpen) {
      setPicked(null);
      setOriginRect(null);
    }
  }, [isOpen]);

  // Set max-height to measured scroll height when open
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (isOpen) {
      el.style.maxHeight = `${el.scrollHeight}px`;
    } else {
      el.style.maxHeight = '0px';
    }
  }, [isOpen, picked]);

  // FLIP: when picked is set with an originRect, translate the new UserComment
  // node so it starts where the suggestion card was, then animate back to 0.
  useLayoutEffect(() => {
    const node = userCommentRef.current;
    if (!node || !originRect) return;

    const targetRect = node.getBoundingClientRect();
    const dx = originRect.left - targetRect.left;
    const dy = originRect.top - targetRect.top;
    const sx = originRect.width / targetRect.width;
    const sy = originRect.height / targetRect.height;

    // Start state: positioned over the source card
    node.style.transformOrigin = 'top left';
    node.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    node.style.transition = 'none';
    node.style.opacity = '1';

    // Force reflow, then apply the end state with a transition
    void node.offsetWidth;
    node.style.transition = `transform var(--commenting-duration) var(--commenting-ease)`;
    node.style.transform = 'translate(0, 0) scale(1, 1)';
  }, [originRect]);

  const handlePick = (s) => {
    // Capture the clicked card's rect BEFORE state changes
    const root = rootRef.current;
    if (root) {
      const card = root.querySelector(`[data-suggestion-card="${s.persona}"]`);
      if (card) {
        setOriginRect(card.getBoundingClientRect());
      }
    }
    setPicked(s);
  };

  const { comments, suggestions } = getMockCommentsFor(post.id);

  return (
    <div
      ref={rootRef}
      id={capsuleId}
      className={`commenting-capsule${isOpen ? ' commenting-capsule--open' : ''}`}
      data-post-id={post.id}
      aria-hidden={!isOpen}
    >
      {comments.map((c, i) => (
        <Comment
          key={c.persona}
          persona={c.persona}
          content={c.content}
          pills={c.pills}
          displayName={displayName}
          handle={handle}
          avatarSrc={avatarSrc}
          avatarInitials={avatarInitials}
          staggerIndex={i}
        />
      ))}

      {picked ? (
        <div ref={userCommentRef}>
          <UserComment
            persona={picked.persona}
            content={picked.content}
            displayName={displayName}
            handle={handle}
            avatarSrc={avatarSrc}
            avatarInitials={avatarInitials}
          />
        </div>
      ) : null}

      <SuggestionRow
        suggestions={suggestions}
        avatarSrc={avatarSrc}
        avatarInitials={avatarInitials}
        pickedPersona={picked?.persona ?? null}
        collapsed={picked !== null}
        onPick={handlePick}
      />

      <div className="commenting-footer">
        <div className="commenting-footer-pill">comment here</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.2: Manual verify the suggestion-pick animation**

In the browser (dev still running):
- Open a post's comments.
- Click any suggestion card. Expected: the card visually "flies" up to land above the suggestion row as a fully styled user comment with the matching persona accent. The other two cards fade. The suggestion row then collapses to 0 height, leaving the user comment in place.
- Close the capsule and reopen — the suggestion row should be visible again (picked state was reset).

If the user-comment snaps instead of animating, the FLIP measurement is happening after the transition already started. Common fix: ensure `setOriginRect` is called in the same click handler tick as `setPicked` (React batches them).

- [ ] **Step 6.3: Commit**

```bash
git add src/features/commenting/CommentsCapsule.jsx
git commit -m "feat(commenting): FLIP-animate picked suggestion card into user comment"
```

---

## Task 7: Final verification

- [ ] **Step 7.1: Run all tests**

Run: `npm test`
Expected: all tests pass, including the new `commentingMock` suite.

- [ ] **Step 7.2: Run production build**

Run: `npm run build`
Expected: build succeeds with no new errors or warnings.

- [ ] **Step 7.3: Full manual checklist**

With `npm run servers` and `npm run dev` running, in the browser walk through every behavior:

1. Each post in the home feed shows the comment icon button in the meta row (unchanged from before).
2. Clicking the icon on Post A: capsule opens, icon FLIPs to centered position, three comments appear with stagger, suggestion row appears, "comment here" pill at bottom.
3. Comments are colored: 1st gray (productivity), 2nd blue (security), 3rd lime (popularity).
4. Each comment has three small "text" sub-pills outlined in its persona color.
5. Suggestion cards: 1 gray, 1 blue, 1 lime, each with a +N badge (1–5).
6. Clicking the icon on Post B: Post A's capsule closes (icon returns), Post B's opens. Only one open at a time.
7. Clicking a suggestion card: it morphs into a user comment styled in the card's persona; other two fade; suggestion row collapses.
8. Closing and reopening the capsule resets the pick (suggestion row visible again).
9. Page reload: all state resets cleanly. No errors in the console.

If anything fails, fix inline and commit a follow-up.

- [ ] **Step 7.4: Final commit (if any tweaks were needed)**

```bash
git status
# If there are changes:
git add -p
git commit -m "fix(commenting): post-verification adjustments"
```

---

## Self-Review Notes

- Spec coverage: every section of the design spec maps to a task — mock data (Task 1), comment + suggestion components (Task 2), toggle + orchestrator (Task 3), integration + PostActions removal (Task 4), open/close + icon FLIP animation (Task 5), suggestion-pick FLIP (Task 6), final verification (Task 7).
- The "Only one capsule open at a time" requirement is enforced by lifting `openCommentsPostId` into `PostsTab.jsx` (Task 4.2).
- The "Stable per-post random N" requirement is realized by hashing `postId|suggestion|persona|i` and deriving `plusValue` deterministically (Task 1.3), verified by a test (Task 1.1 — "deterministic" case).
- "One comment per persona, varied" is locked by `PERSONA_ORDER` in `commentingMock.js` and verified by a test.
- No placeholders, no TBDs, no "similar to Task N" — every step contains the actual code or command.
- Method names are consistent across tasks: `onToggle`, `onPick`, `getMockCommentsFor`, `isCommentsOpen`, `onToggleComments`.
