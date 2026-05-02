import { useState, useRef, useEffect } from 'react';
import PostImage from './PostImage.jsx';
import PostActions from './PostActions.jsx';

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
    attachment,
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
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);
    if (days >= 1) return `${days}d`;
    if (totalHours >= 1) return `${totalHours}h`;
    return `${Math.max(1, totalMinutes)}m`;
  })();

  // ── Avatar drag (left → right, visual only) ──────────────────────────────
  const [avatarDx, setAvatarDx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null); // { startX, listeners }

  const onAvatarPointerDown = (e) => {
    if (e.button !== 0) return; // left / primary only
    e.preventDefault();         // stop text-selection & browser drag

    const startX = e.clientX;
    setIsDragging(true);

    const onMove = (ev) => {
      const dx = Math.max(0, ev.clientX - startX);
      // soft resistance: fast at first, slows toward 32px cap
      setAvatarDx(Math.min(32, dx * 0.5 - dx * dx * 0.0015));
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      dragRef.current = null;
      setIsDragging(false);
      setAvatarDx(0);
    };

    dragRef.current = { startX, listeners: { onMove, onUp } };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // Clean up listeners if component unmounts mid-drag
  useEffect(() => {
    return () => {
      if (dragRef.current) {
        const { onMove, onUp } = dragRef.current.listeners;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }
    };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <article
      className={`post-card${attachment ? ' post-card--has-attachment' : ''}`}
      data-persona={post.persona}
      style={{ '--post-accent': noteColor }}
    >
      <div className={attachment ? 'post-composite' : undefined}>
        <div className="post-card-bubble">
          <div className="post-card-head">
            <div
              className="post-avatar"
              style={{
                transform: `translateX(${avatarDx}px)`,
                transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
              }}
              onPointerDown={onAvatarPointerDown}
              aria-hidden
            >
              {avatarSrc ? <img className="post-avatar-img" src={avatarSrc} alt="" /> : avatarInitials}
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

        {attachment ? (
          <PostImage
            src={attachment.url}
            alt={attachment.filename || ''}
            accentColor={noteColor}
          />
        ) : null}
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
        <div className="post-meta-right">
          <PostActions />
        </div>
      </div>
    </article>
  );
}
