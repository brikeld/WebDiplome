export default function Comment({
  persona,
  content,
  displayName,
  avatarSrc,
  avatarInitials,
  staggerIndex = 0,
  metaLeft,
  metaCenter,
}) {
  const metaInline = [metaLeft, metaCenter].filter(Boolean).join(' · ');

  return (
    <div
      className="commenting-comment"
      data-persona={persona}
      style={{ transitionDelay: `${staggerIndex * 60}ms` }}
    >
      <div className="commenting-comment-main">
        <div className="commenting-comment-avatar" aria-hidden>
          {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{avatarInitials}</span>}
        </div>
        <div className="commenting-comment-text">
          <p className="commenting-comment-name">{displayName}</p>
          <p className="commenting-comment-content">{content}</p>
        </div>
      </div>
      {metaInline ? (
        <span className="commenting-comment-meta-inline" aria-label="Comment metadata">
          {metaInline}
        </span>
      ) : null}
    </div>
  );
}
