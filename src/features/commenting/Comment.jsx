function CommentMetaIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5l-3.7 2.8A.6.6 0 0 1 5 17.4V15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function CommentMetaRow({ persona, metaLeft, metaCenter }) {
  return (
    <div
      className="commenting-comment-meta commenting-comment-meta--detached"
      data-persona={persona}
      aria-label="Comment metadata"
    >
      <div className="commenting-meta-left">
        <span className="post-meta-pill">{metaLeft}</span>
      </div>
      <div className="commenting-meta-center">
        <span className="post-meta-pill">{metaCenter}</span>
      </div>
      <div className="commenting-meta-right">
        <span className="post-meta-pill commenting-meta-icon-chip" aria-hidden>
          <CommentMetaIcon />
        </span>
      </div>
    </div>
  );
}

export default function Comment({
  persona,
  content,
  displayName,
  handle,
  avatarSrc,
  avatarInitials,
  staggerIndex = 0,
  metaLeft,
  metaCenter,
  showMeta = true,
}) {
  return (
    <div
      className="commenting-comment"
      data-persona={persona}
      style={{ transitionDelay: `${staggerIndex * 60}ms` }}
    >
      <div className="commenting-comment-bubble">
        <div className="commenting-comment-head">
          <div className="commenting-comment-avatar" aria-hidden>
            {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{avatarInitials}</span>}
          </div>
          <div className="commenting-comment-text">
            <p className="commenting-comment-content">{content}</p>
            <div className="commenting-comment-byline">
              <p className="commenting-comment-name">{displayName}</p>
              {handle ? <p className="commenting-comment-handle">{handle}</p> : null}
            </div>
          </div>
        </div>
      </div>

      {showMeta ? (
        <CommentMetaRow persona={persona} metaLeft={metaLeft} metaCenter={metaCenter} />
      ) : null}
    </div>
  );
}
