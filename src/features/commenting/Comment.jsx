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
