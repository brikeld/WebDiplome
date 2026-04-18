import { useMemo } from 'react';

export default function PostCard({ post }) {
  const {
    content,
    noteColor,
    personaLabel,
    sentiment,
    displayName,
    handle,
    avatarInitials,
    avatarSrc,
    dateLabel,
  } = post;

  const scoreImpact = useMemo(() => {
    const magnitude = Math.floor(Math.random() * 5) + 1; // 1..5
    const sign = sentiment === 'negative' ? '-' : '+';
    return { sign, magnitude };
  }, []);

  const sentimentClass = sentiment === 'negative' ? 'negative' : 'positive';

  return (
    <article className="post-card" style={{ '--post-accent': noteColor }}>
      <div className="post-header">
        <div className="post-meta">
          <div className="post-avatar" aria-hidden>
            {avatarSrc ? (
              <img className="post-avatar-img" src={avatarSrc} alt="" />
            ) : (
              avatarInitials
            )}
          </div>
          <div className="post-name-block">
            <div className="post-name-row">
              <span className="post-name">{displayName}</span>
              {handle ? <span className="post-handle-inline">{handle}</span> : null}
            </div>
          </div>
        </div>
        {dateLabel ? <div className="post-date">{dateLabel}</div> : null}
      </div>
      <div className="post-text">{content}</div>
      <div className="post-system-row">
        <div className="post-system-annotation" role="note" aria-label="System note">
          <span>System note — </span>
          <span className={`post-system-persona ${sentimentClass}`}>[{personaLabel}]</span>{' '}
          <span className="post-system-impact">
            [{scoreImpact.sign}
            {scoreImpact.magnitude}
            <span className="post-system-pct">%</span>]
          </span>
        </div>
        <div className="post-actions" aria-label="Engagement">
          <button
            type="button"
            className="action-btn"
            onClick={() => {}}
            aria-expanded={false}
          >
            ◻ <span>0</span>
          </button>
        </div>
      </div>
    </article>
  );
}
