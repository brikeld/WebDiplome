import Comment from './Comment.jsx';
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
        <span className="commenting-suggestion-option-loading" aria-hidden>
          <span className="commenting-suggestion-option-spinner" />
          <span className="commenting-suggestion-option-loading-text">Generating</span>
        </span>
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
  personaBadgePersona,
  picked = null,
  userCommentRef,
  postId,
  displayName,
  onPick,
}) {
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
      <div
        ref={userCommentRef}
        data-flip-root
        className="commenting-suggestion-picked"
        data-persona={picked.persona}
      >
        <Comment
          persona={picked.persona}
          content={picked.content}
          displayName={displayName}
          avatarSrc={avatarSrc}
          avatarInitials={avatarInitials}
          personaBadgePersona={personaBadgePersona}
          metaLeft={mockCommentTimeAgo(postId, picked.persona, 3)}
          metaCenter={commentMetaCenterLine(postId, picked.persona)}
        />
      </div>
    );
  }

  return (
    <div className="commenting-suggestion-shell">
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
      {suggestionsError ? (
        <p className="commenting-suggestion-error" role="alert">
          {suggestionsError}
        </p>
      ) : null}
    </div>
  );
}
