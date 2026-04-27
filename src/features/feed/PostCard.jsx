export default function PostCard({ post }) {
  const { content, noteColor, displayName, handle, avatarInitials, avatarSrc } = post;

  return (
    <article
      className="post-card"
      data-persona={post.persona}
      style={{
        '--post-accent': noteColor,
      }}
    >
      <div className="post-card-bubble">
        <div className="post-card-head">
          <div className="post-avatar" aria-hidden>
            {avatarSrc ? (
              <img className="post-avatar-img" src={avatarSrc} alt="" />
            ) : (
              avatarInitials
            )}
          </div>
          <div className="post-card-text">
            <div className="post-card-lead">
              <p className="post-lead">{content}</p>
            </div>
            <div className="post-card-byline">
              <p className="post-card-name">{displayName}</p>
              {handle ? <p className="post-card-handle">{handle}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
