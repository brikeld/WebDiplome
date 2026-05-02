import { useState, useRef, useEffect } from 'react';
import PostImage from './PostImage.jsx';
import PostActions from './PostActions.jsx';

// How far right (as fraction of max travel) before we snap to far right
const SNAP_THRESHOLD = 0.35;

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
    const days = Math.floor(totalHours / 24);
    if (days >= 1) return `${days}d`;
    if (totalHours >= 1) return `${totalHours}h`;
    return `${Math.max(1, totalMinutes)}m`;
  })();

  // ── Avatar drag ──────────────────────────────────────────────────────────
  const bubbleRef = useRef(null);
  const avatarRef = useRef(null);
  const dragListeners = useRef(null);
  const currentXRef = useRef(0); // tracks position without re-render during drag

  const [avatarX, setAvatarX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isParked, setIsParked] = useState(false); // true = avatar is at far right

  // Distance from avatar's right edge to bubble's inner right edge
  const getMaxDx = () => {
    if (!bubbleRef.current || !avatarRef.current) return 200;
    const bubbleRect = bubbleRef.current.getBoundingClientRect();
    const avatarRect = avatarRef.current.getBoundingClientRect();
    // 24px = bubble's right padding
    return Math.max(0, bubbleRect.right - 24 - avatarRect.right);
  };

  const moveTo = (x) => {
    currentXRef.current = x;
    setAvatarX(x);
  };

  const onAvatarPointerDown = (e) => {
    if (e.button !== 0) return;
    // When parked at right, a click returns it — handled by onClick below
    if (isParked) return;

    e.preventDefault();
    const maxDx = getMaxDx();
    const startX = e.clientX;
    setIsDragging(true);

    const onMove = (ev) => {
      const x = Math.max(0, Math.min(maxDx, ev.clientX - startX));
      moveTo(x);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      dragListeners.current = null;
      setIsDragging(false);

      if (currentXRef.current / maxDx >= SNAP_THRESHOLD) {
        moveTo(maxDx);
        setIsParked(true);
      } else {
        moveTo(0);
      }
    };

    dragListeners.current = { onMove, onUp };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const onAvatarClick = () => {
    if (!isParked) return;
    setIsParked(false);
    moveTo(0);
  };

  useEffect(() => {
    return () => {
      if (dragListeners.current) {
        document.removeEventListener('pointermove', dragListeners.current.onMove);
        document.removeEventListener('pointerup', dragListeners.current.onUp);
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
        <div className="post-card-bubble" ref={bubbleRef}>
          <div className="post-card-head">
            <div
              ref={avatarRef}
              className="post-avatar"
              style={{
                transform: `translateX(${avatarX}px)`,
                transition: isDragging
                  ? 'none'
                  : 'transform 0.38s cubic-bezier(0.34,1.4,0.64,1)',
                cursor: isParked ? 'pointer' : isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
              }}
              onPointerDown={onAvatarPointerDown}
              onClick={onAvatarClick}
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
