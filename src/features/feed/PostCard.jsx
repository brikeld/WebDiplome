import { useState, useRef, useCallback, useEffect } from 'react';
import PostImage from './PostImage.jsx';
import PostActions from './PostActions.jsx';

const DRAG_THRESHOLD = 64;
const ERASE_BATCH = 3;
const ERASE_MS = 14;
const TYPE_MS = 28;

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
    thinking,
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
    const hours = Math.floor(totalMinutes / 60);
    const days = Math.floor(hours / 24);
    if (days >= 1) return `${days}d`;
    if (hours >= 1) return `${hours}h`;
    return `${Math.max(1, totalMinutes)}m`;
  })();

  const [displayedText, setDisplayedText] = useState(content);
  const [mode, setMode] = useState('post'); // 'post' | 'thinking'
  const [isAnimating, setIsAnimating] = useState(false);
  const [avatarDx, setAvatarDx] = useState(0);

  // Holds active document-level drag listeners so we can remove them
  const activeDragRef = useRef(null);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Captured in the pointerdown closure — always current at drag-start
  const modeRef = useRef(mode);
  const displayedTextRef = useRef(displayedText);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { displayedTextRef.current = displayedText; }, [displayedText]);

  const triggerFlip = useCallback(() => {
    clearTimer();
    const currentMode = modeRef.current;
    const toText = currentMode === 'post' ? (thinking ?? content) : content;
    const nextMode = currentMode === 'post' ? 'thinking' : 'post';

    setIsAnimating(true);
    let buf = displayedTextRef.current;

    // Phase 1: erase current text
    timerRef.current = setInterval(() => {
      buf = buf.slice(0, Math.max(0, buf.length - ERASE_BATCH));
      setDisplayedText(buf);
      if (buf.length === 0) {
        clearTimer();
        // Phase 2: type new text
        let typed = '';
        timerRef.current = setInterval(() => {
          if (typed.length >= toText.length) {
            clearTimer();
            setMode(nextMode);
            setIsAnimating(false);
          } else {
            typed = toText.slice(0, typed.length + 1);
            setDisplayedText(typed);
          }
        }, TYPE_MS);
      }
    }, ERASE_MS);
  }, [thinking, content, clearTimer]);

  const onAvatarPointerDown = useCallback((e) => {
    if (isAnimating) return;
    if (activeDragRef.current) return; // already dragging
    // Only left button / primary touch
    if (e.button !== undefined && e.button !== 0) return;

    const startX = e.clientX;
    let dx = 0;

    const onMove = (ev) => {
      dx = Math.max(0, ev.clientX - startX);
      setAvatarDx(Math.min(28, dx * 0.38));
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      activeDragRef.current = null;
      setAvatarDx(0);
      if (dx >= DRAG_THRESHOLD) triggerFlip();
    };

    activeDragRef.current = { onMove, onUp };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [isAnimating, triggerFlip]);

  // Clean up everything on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      if (activeDragRef.current) {
        document.removeEventListener('pointermove', activeDragRef.current.onMove);
        document.removeEventListener('pointerup', activeDragRef.current.onUp);
      }
    };
  }, [clearTimer]);

  // Reset when content changes (e.g. profile switch)
  useEffect(() => {
    clearTimer();
    setDisplayedText(content);
    setMode('post');
    setIsAnimating(false);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

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
                transition: avatarDx === 0 && !activeDragRef.current
                  ? 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)'
                  : 'none',
                cursor: isAnimating ? 'default' : 'grab',
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
                <p className="post-lead">
                  {displayedText}
                  {isAnimating && <span className="post-typing-cursor" aria-hidden>|</span>}
                </p>
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
