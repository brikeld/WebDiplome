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
              <span className="commenting-suggestion-card__text">{s.content}</span>
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
