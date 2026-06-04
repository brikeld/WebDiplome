const PERSONA_ORDER = ['productivite', 'securite', 'popularite'];

function SuggestionOption({ suggestion, loading, onPick }) {
  const persona = suggestion?.persona ?? 'productivite';
  const slotKey = suggestion?.slotKey ?? persona;
  const disabled = loading || !suggestion?.content;

  return (
    <button
      type="button"
      className={`commenting-suggestion-option${loading ? ' commenting-suggestion-option--loading' : ''}`}
      data-persona={persona}
      data-suggestion-card={slotKey}
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
  allowedPersonas = PERSONA_ORDER,
  commentsRestricted = false,
  onPick,
}) {
  const personaOrder = PERSONA_ORDER.filter((p) => allowedPersonas.includes(p));
  const singleTrackRestricted =
    commentsRestricted && personaOrder.length === 1 && suggestions.length >= 3;

  const optionRows = singleTrackRestricted
    ? suggestions.slice(0, 3).map((s, i) => ({
        ...s,
        persona: personaOrder[0],
        slotKey: s.slotKey ?? `${personaOrder[0]}-${i}`,
      }))
    : personaOrder.map((persona, i) => {
        const match = suggestions.find((s) => s.persona === persona);
        return (
          match ?? {
            persona,
            content: '',
            plusValue: i + 1,
            slotKey: `${persona}-${i}`,
          }
        );
      });

  return (
    <div className="commenting-suggestion-shell">
      {commentsRestricted ? (
        <p className="commenting-suggestion-restricted" role="status">
          Low persona score — you can only reply on this track until it recovers.
        </p>
      ) : null}
      <div
        className={`commenting-suggestion-options${
          !singleTrackRestricted && personaOrder.length === 2
            ? ' commenting-suggestion-options--dual'
            : ''
        }`}
      >
        {optionRows.map((s) => (
          <SuggestionOption
            key={s.slotKey ?? s.persona}
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
