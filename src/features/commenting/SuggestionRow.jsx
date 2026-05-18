import UserComment from './UserComment.jsx';
import { CommentMetaRow } from './Comment.jsx';
import { commentMetaCenterLine, mockCommentTimeAgo } from '@/lib/commentMetaStrip.js';

export default function SuggestionRow({
  suggestions,
  avatarSrc,
  avatarInitials,
  picked = null,
  userCommentRef,
  postId,
  displayName,
  handle,
  onPick,
}) {
  const shellClass = `commenting-suggestion-shell${picked ? ' commenting-suggestion-shell--picked' : ''}`;

  if (picked) {
    return (
      <div className="commenting-suggestion-picked-stack">
        <div
          ref={userCommentRef}
          data-flip-root
          className={`${shellClass} commenting-suggestion-shell--persona-fill`}
          data-persona={picked.persona}
        >
          <div className="commenting-suggestion-picked-inner">
            <UserComment
              persona={picked.persona}
              content={picked.content}
              displayName={displayName}
              handle={handle}
              avatarSrc={avatarSrc}
              avatarInitials={avatarInitials}
              metaLeft={mockCommentTimeAgo(postId, picked.persona, 3)}
              metaCenter={commentMetaCenterLine(postId, picked.persona)}
              showMeta={false}
            />
          </div>
        </div>
        <CommentMetaRow
          persona={picked.persona}
          metaLeft={mockCommentTimeAgo(postId, picked.persona, 3)}
          metaCenter={commentMetaCenterLine(postId, picked.persona)}
        />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="commenting-suggestion-row">
        <div className="commenting-suggestion-avatar-rail">
          <div className="commenting-comment-avatar" aria-hidden>
            {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{avatarInitials}</span>}
          </div>
        </div>
        <div className="commenting-suggestion-options">
          {suggestions.map((s) => (
            <button
              key={s.persona}
              type="button"
              className="commenting-suggestion-option"
              data-persona={s.persona}
              data-suggestion-card={s.persona}
              onClick={() => onPick?.(s)}
            >
              <span className="commenting-suggestion-option-text">{s.content}</span>
              <span className="commenting-suggestion-option-plus" aria-hidden>
                +{s.plusValue}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
