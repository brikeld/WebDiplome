import '@/styles/commenting.css';
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

  // Set max-height to measured scroll height when open (Task 3 logic, preserved).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (isOpen) {
      // Release the clamp before measuring; otherwise scrollHeight reports
      // the already-clamped height when content grows (e.g. adding UserComment).
      el.style.maxHeight = 'none';
      const natural = el.scrollHeight;
      el.style.maxHeight = `${natural}px`;
    } else {
      el.style.maxHeight = '0px';
    }
  }, [isOpen, picked]);

  // FLIP: when picked is set with an originRect, translate the new UserComment
  // node so it starts where the suggestion card was, then animate back to identity.
  useLayoutEffect(() => {
    const node = userCommentRef.current;
    if (!node || !originRect) return;

    const targetRect = node.getBoundingClientRect();
    const dx = originRect.left - targetRect.left;
    const dy = originRect.top - targetRect.top;
    const sx = targetRect.width === 0 ? 1 : originRect.width / targetRect.width;
    const sy = targetRect.height === 0 ? 1 : originRect.height / targetRect.height;

    node.style.transformOrigin = 'top left';
    node.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    node.style.transition = 'none';
    node.style.opacity = '1';
    node.style.willChange = 'transform';

    // Force reflow, then apply the end state with a transition.
    void node.offsetWidth;
    node.style.transition = `transform var(--commenting-duration) var(--commenting-ease)`;
    node.style.transform = 'translate(0, 0) scale(1, 1)';

    const cleanup = () => {
      node.style.willChange = '';
      node.style.transition = '';
    };
    node.addEventListener('transitionend', cleanup, { once: true });
    return () => node.removeEventListener('transitionend', cleanup);
  }, [originRect]);

  const handlePick = (s) => {
    // Capture the clicked card's rect BEFORE state changes so the FLIP
    // effect knows where the morph should originate.
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
        <div ref={userCommentRef} data-flip-root>
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
