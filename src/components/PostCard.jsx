import { useMemo } from 'react';

export default function PostCard({ post }) {
  const {
    content,
    noteColor,
    personaLabel,
    sentiment,
    displayName,
    avatarInitials,
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
            {avatarInitials}
          </div>
          <div>
            <div className="post-name">{displayName}</div>
            <div className="post-cat">{personaLabel}</div>
          </div>
        </div>
        {dateLabel ? <div className="post-date">{dateLabel}</div> : null}
      </div>
      <div className="post-text">{content}</div>
      <div className="post-system-annotation" role="note" aria-label="System note">
        <span>System note — </span>
        <span className={`post-system-persona ${sentimentClass}`}>
          [{personaLabel}]
        </span>{' '}
        <span>
          [{scoreImpact.sign}
          {scoreImpact.magnitude}%]
        </span>
      </div>
      <div className="post-actions" aria-label="Engagement">
        <div className="action-btn">
          ♥ <span>—</span>
        </div>
        <div className="action-btn">
          ◻ <span>—</span>
        </div>
        <div className="action-btn">
          ◎ <span>—</span>
        </div>
      </div>
    </article>
  );
}
