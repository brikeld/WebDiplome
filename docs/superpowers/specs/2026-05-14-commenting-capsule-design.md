# Commenting Capsule — Design

**Date:** 2026-05-14
**Scope:** WebDiplome frontend (`src/`)
**Status:** Approved for implementation planning

## Goal

Add an interactive commenting UI to each post in the feed. Pressing the existing comment icon on a post opens an animated capsule below the post containing three mock comments and a suggestion row that lets the user "comment" by picking one of three persona-tinted suggestions.

This is a presentation-only feature: no backend, no persistence. Mock content is generated deterministically from each post's id so values don't re-roll on re-render.

## User-Facing Behavior

1. Every post card shows the comment icon button in its meta row (existing `PostActions`).
2. Clicking the icon:
   - Animates the icon button from the meta-row right slot to a centered position between the post and the capsule below.
   - Expands a comments capsule below the post.
   - Reveals three mock comments (one per persona — productivity, security, popularity in that fixed order) with a small per-item stagger.
   - Reveals a suggestion row at the bottom: avatar + three persona-tinted suggestion cards, each with a `+N` badge (N is a stable random 1–5 derived from post id + persona key).
3. Clicking the icon again (or opening a different post's comments) closes the capsule and returns the icon to the meta row.
4. Only one capsule is open at a time across the entire feed. Opening a new one auto-closes any open one.
5. Picking a suggestion card:
   - The chosen card morphs (FLIP) into a new user-comment row that lands above the suggestion row.
   - The other two cards collapse + fade out.
   - The new user-comment row is styled exactly like the three mock comments, accented with the chosen persona's color.

## Scope Limits

- No commenting state survives a page reload.
- No "edit" or "delete" on the user comment once picked. Picking again is not supported in this iteration; the suggestion row stays collapsed.
- No real persona-driven generation of suggestion text — strings are mock placeholders defined in `commentingMock.js`.
- Comment sub-pills are mock-labeled (`text`) and do not represent real data.

## Architecture

### New folder: `src/features/commenting/`

| File | Responsibility |
|---|---|
| `CommentsToggle.jsx` | Renders the comment icon button. Receives `isOpen` and `onToggle` from the parent. Replaces the existing `PostActions.jsx` usage inside `PostCard`. Owns FLIP measurement of its own DOM node so the icon can animate between the meta-row slot and the centered overlap position. |
| `CommentsCapsule.jsx` | The expanding container. Receives `post`, `isOpen`. Reads mock data from `commentingMock.js`. Renders three `<Comment />` rows + `<SuggestionRow />` + (after a pick) a `<UserComment />` row inserted above the suggestion row. Manages enter/exit animation timing. |
| `Comment.jsx` | One mock comment: avatar + bubble with content/name/handle (smaller than main post) + three sub-pills. Accepts `persona` to drive accent color. |
| `SuggestionRow.jsx` | Avatar + three suggestion cards. Each card has text + a circular `+N` badge. Card click fires `onPick(suggestion)`. After a pick, the row is collapsed by `CommentsCapsule`. |
| `UserComment.jsx` | Renders the picked suggestion as if it were a new comment. Visually identical to `<Comment />`; the only difference is it's the morph target of the picked suggestion card and runs the FLIP-in animation rather than the staggered reveal used for mock comments. |
| `commentingMock.js` | Pure module. Exports `getMockCommentsFor(postId)` → `{ comments: [3 items], suggestions: [3 items] }`. Uses the same `stablePct`-style hash already present in `PostsTab.jsx` so values are deterministic per `postId`. |
| `commenting.css` | All styles and keyframes for the feature, namespaced under `.commenting-*`. |

### Integration points

1. **`src/features/feed/PostsTab.jsx`**
   - Adds `const [openCommentsPostId, setOpenCommentsPostId] = useState(null)`.
   - Passes `isCommentsOpen={openCommentsPostId === p.id}` and `onToggleComments={() => setOpenCommentsPostId(prev => prev === p.id ? null : p.id)}` to each `<PostCard />`.

2. **`src/features/feed/PostCard.jsx`**
   - Receives `isCommentsOpen`, `onToggleComments` as new props.
   - Replaces `<PostActions />` with `<CommentsToggle isOpen={isCommentsOpen} onToggle={onToggleComments} />`.
   - Returns a React fragment: `[<article>...</article>, <CommentsCapsule post={post} isOpen={isCommentsOpen} />]`. The capsule is rendered as a **sibling** of the article (not a child) so it sits below the post-card boundary in the `.posts-tab` flow, allowing the toggle icon's FLIP animation to visually straddle the gap between post and capsule without being clipped by the article's border-radius/overflow.

3. **`src/features/feed/PostActions.jsx`**
   - Deleted. Its only usage is inside `PostCard.jsx` and is being replaced by `CommentsToggle`.

### State & data flow

```
PostsTab (owns openCommentsPostId)
  └─ PostCard (receives isCommentsOpen, onToggleComments)
       ├─ CommentsToggle (renders icon, calls onToggleComments)
       └─ CommentsCapsule (reads mock data, owns pickedSuggestion local state)
            ├─ Comment × 3 (mock)
            ├─ UserComment (rendered only after pickedSuggestion is set)
            └─ SuggestionRow (renders unless pickedSuggestion is set)
```

`pickedSuggestion` is local to `CommentsCapsule` and resets when `isOpen` transitions from `true → false → true` (closing & reopening a capsule clears the pick).

## Visual Specification

### Comment styling

- Bubble: ~85% the size of the main post bubble. Achieved via reduced padding + smaller font-size tokens (no `transform: scale`).
- Border: 1.5px solid `var(--persona-accent)` per the comment's persona. No fill.
- Same rounded-rectangle radius as the main post bubble.
- Avatar: smaller version of the post avatar (same `avatarSrc`).
- Layout: avatar on the left, bubble on the right, sub-pills row below the bubble.

### Sub-pills

- Three pills per comment, mirroring the main post's meta row structure.
- Outlined in the comment's persona accent. Label `text` for all three (mock).
- Smaller font + tighter padding than main post meta pills.

### Suggestion cards

- Filled with the persona's accent color at full saturation:
  - Productivity: `#D8D8D8` (light gray) → dark text.
  - Popularity: `#CCF847` (lime) → dark text.
  - Security: `#759AEF` (blue) → white text.
- Card content: a short mock text line (~3 lines, truncated).
- `+N` badge: dark circular chip pinned to the bottom-right of the card. N is determined by `getMockCommentsFor(postId).suggestions[i].plusValue` (stable 1–5).

### "Comment here" footer pill

- A pill at the very bottom of the capsule (full-width visual, like the screenshot's grey pill labelled "comment here"). Visual only — does not accept text input. Acts as a visual anchor matching the screenshot.

### Capsule container

- Outlined card matching the rounded-rectangle shape of `.posts-capsule`, slightly narrower than the post above it (the screenshot shows it indented).
- Padding: enough breathing room around the three comments and suggestion row.

## Animation Specification

All animations use easing `cubic-bezier(0.22, 1, 0.36, 1)` and 280ms duration unless noted. (We will reconfirm the exact easing matches the existing post animations during implementation; substitute the existing token if there is one.)

| Trigger | Element | Effect |
|---|---|---|
| Open | Comment icon | FLIP from meta-row slot to a centered pill between post and capsule. Icon itself does not change shape; the surrounding pill background remains the same icon-button style, just relocated. |
| Open | Capsule | `max-height: 0 → auto` (measured) + opacity 0 → 1 + slight `transform: translateY(-4px) → 0`. |
| Open | Each `Comment` | Stagger of 60ms per item. Each: opacity 0 → 1 + `translateY(8px) → 0`. |
| Open | `SuggestionRow` | Reveals after the last comment with the same per-item stagger applied to its three cards. |
| Pick | Chosen card | FLIP to the position/size of a new `UserComment` row appended above the suggestion row. Card content cross-fades to comment content. `+N` badge fades out during the transition. |
| Pick | Other two cards | Fade out (opacity → 0) while the chosen card FLIPs. They keep their slot until the row collapses. |
| Pick | Suggestion row | Once the chosen card has finished its FLIP into the user-comment slot, the entire suggestion row (now visually empty: one card removed, two faded) collapses height to 0 in one motion. |
| Close | Capsule | Reverse of open. Icon FLIP-returns to the meta row. |

## Mock Data Contract (`commentingMock.js`)

```js
// Pure, deterministic. No imports of React.
export function getMockCommentsFor(postId) {
  // Returns:
  // {
  //   comments: [
  //     { persona: 'productivite', content: string, pills: [string, string, string] },
  //     { persona: 'securite',     content: string, pills: [string, string, string] },
  //     { persona: 'popularite',   content: string, pills: [string, string, string] },
  //   ],
  //   suggestions: [
  //     { persona: 'productivite', content: string, plusValue: 1..5 },
  //     { persona: 'securite',     content: string, plusValue: 1..5 },
  //     { persona: 'popularite',   content: string, plusValue: 1..5 },
  //   ],
  // }
}
```

Hashing uses the same `((h * 31 + charCode) >>> 0) % N` pattern as `PostsTab.jsx` to pick from a small bank of mock strings.

## Testing Plan

- No unit tests are added (animation + presentation, no logic worth isolating).
- Manual verification:
  1. `npm run servers` + `npm run dev`.
  2. Open the home feed.
  3. Click the comment icon on a post — capsule opens with the described animation, icon moves to centered position.
  4. Click the comment icon on a different post — first capsule closes, second opens. Only one is ever open.
  5. Pick a suggestion — chosen card morphs into a user-comment row above the (now-collapsing) suggestion row.
  6. Close the capsule — icon returns, capsule collapses.
  7. Reopen the same post's capsule — `pickedSuggestion` is cleared (suggestion row is visible again).
- Build sanity: `npm run build` must succeed with no new errors/warnings introduced by the new module.

## Out of Scope

- Persisting the picked suggestion across reloads.
- Editing or deleting the user comment.
- A real text-input mode for the "comment here" footer.
- Wiring suggestion picks to score deltas, profile state, or any backend.
- Accessibility audit beyond preserving the existing `aria-label="Comment"` on the toggle and adding `aria-expanded` / `aria-controls`.

## Open Risks / Notes

- The icon's FLIP animation crosses two different DOM ancestors (meta-row → capsule overlap area). Implementation will need either a fixed-position phantom during the transition or measurement-driven `transform` on the original node. Default approach: keep the original node, apply `transform` against a measured delta, never reparent.
- If the existing easing token in the codebase differs from `cubic-bezier(0.22, 1, 0.36, 1)`, use whatever the existing post animations already use to stay consistent. To be confirmed during implementation.
