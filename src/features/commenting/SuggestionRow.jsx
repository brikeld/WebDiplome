import UserComment from './UserComment.jsx';
import { CommentMetaRow } from './Comment.jsx';
import { commentMetaCenterLine, mockCommentTimeAgo } from '@/lib/commentMetaStrip.js';

const PERSONA_ORDER = ['productivite', 'securite', 'popularite'];

function SuggestionOption({ suggestion, loading, onPick }) {
  const persona = suggestion?.persona ?? 'productivite';
  const disabled = loading || !suggestion?.content;

  return (
    <button
      type="button"
      className={`commenting-suggestion-option${loading ? ' commenting-suggestion-option--loading' : ''}`}
      data-persona={persona}
      data-suggestion-card={persona}
      disabled={disabled}
      onClick={() => !disabled && onPick?.(suggestion)}
      aria-busy={loading || undefined}
      aria-label={loading ? 'Generating comment option' : `Use comment: ${suggestion?.content}`}
    >
      {loading ? (
        <span className="commenting-suggestion-option-spinner" aria-hidden />
      ) : (
        <>
          <span className="commenting-suggestion-option-text">{suggestion.content}</span>
          <span className="commenting-suggestion-option-plus" aria-hidden>
            +{suggestion.plusValue}
          </span>
        </>
      )}
    </button>
  );
}

export default function SuggestionRow({
  suggestions = [],
  suggestionsLoading = false,
  suggestionsError = null,
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

  const optionRows = PERSONA_ORDER.map((persona, i) => {
    const match = suggestions.find((s) => s.persona === persona);
    return (
      match ?? {
        persona,
        content: '',
        plusValue: i + 1,
      }
    );
  });

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
          {optionRows.map((s) => (
            <SuggestionOption
              key={s.persona}
              suggestion={s}
              loading={suggestionsLoading}
              onPick={onPick}
            />
          ))}
        </div>
      </div>
      {suggestionsError ? (
        <p className="commenting-suggestion-error" role="alert">
          {suggestionsError}
        </p>
      ) : null}
    </div>
  );
}
