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
  const metaBottom = [metaLeft, metaCenter].filter(Boolean).join(' · ');

  return (
    <div
      className="commenting-comment"
      data-persona={persona}
      style={{ transitionDelay: `${staggerIndex * 60}ms` }}
    >
      <div className="commenting-comment-head">
        <div className="commenting-comment-avatar" aria-hidden>
          {avatarSrc ? (
            <img className="commenting-comment-avatar-img" src={avatarSrc} alt="" />
          ) : (
            <span>{avatarInitials}</span>
          )}
        </div>
        <div className="commenting-comment-lead">
          <p className="commenting-comment-content">{content}</p>
        </div>
        <div className="commenting-comment-footer">
          <span className="commenting-comment-name">{displayName}</span>
          {metaBottom ? (
            <span className="commenting-comment-meta-inline" aria-label="Comment metadata">
              {metaBottom}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
