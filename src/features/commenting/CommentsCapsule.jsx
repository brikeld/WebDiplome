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
      // Release the clamp before measuring; otherwise scrollHeight reports
      // the already-clamped height when content grows (e.g. adding UserComment).
      el.style.maxHeight = 'none';
      const natural = el.scrollHeight;
      el.style.maxHeight = `${natural}px`;
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
        onPick={setPicked}
      />

      <div className="commenting-footer">
        <div className="commenting-footer-pill">comment here</div>
      </div>
    </div>
  );
}
