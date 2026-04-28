export default function PostCard({ post }) {
  const {
    content,
    noteColor,
    displayName,
    handle,
    avatarInitials,
    avatarSrc,
    createdAt,
    systemDeltaPct = 1,
    persona,
  } = post;

  const personaLabel = (() => {
    const key = String(persona ?? '').toLowerCase();
    if (key === 'popularite' || key === 'popularity' || key === 'social') return 'Social';
    if (key === 'securite' || key === 'security') return 'Security';
    if (key === 'productivite' || key === 'productivity') return 'Productivity';
    return 'Social';
  })();

  const timeAgo = (() => {
    if (!createdAt) return '—';
    const d =
      typeof createdAt === 'number'
        ? new Date(createdAt)
        : typeof createdAt === 'string'
          ? new Date(createdAt)
          : createdAt instanceof Date
            ? createdAt
            : null;
    if (!d || Number.isNaN(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    if (diffMs <= 0) return 'just now';
    const totalMinutes = Math.floor(diffMs / 60_000);
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);
    if (days >= 1) return `${days}d`;
    if (totalHours >= 1) return `${totalHours}h`;
    return `${Math.max(1, totalMinutes)}m`;
  })();

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

      <div className="post-meta-row" aria-label="Post metadata">
        <div className="post-meta-left">
          <span className="post-meta-pill">{timeAgo} ago</span>
        </div>

        <div className="post-meta-center">
          <span className="post-meta-pill">
            System note [{personaLabel}] [+{systemDeltaPct}%]
          </span>
        </div>

        <div className="post-meta-right" aria-hidden>
          <span className="post-meta-circle">L</span>
          <span className="post-meta-circle">C</span>
        </div>
      </div>
    </article>
  );
}
