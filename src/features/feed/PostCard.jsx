import { lazy, Suspense, useLayoutEffect, useRef } from 'react';
import PostImage from './PostImage.jsx';
import PostDocument from './PostDocument.jsx';
import { isPdfDocumentAsset } from '@/lib/attachmentKind.js';
import CommentsToggle from '@/features/commenting/CommentsToggle.jsx';
import CommentsCapsule from '@/features/commenting/CommentsCapsule.jsx';

const PostPdfCarousel = lazy(() => import('./PostPdfCarousel.jsx'));

function HideIcon({ hidden }) {
  if (hidden) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function PostCard({
  post,
  animateEnter = false,
  isCommentsOpen = false,
  onToggleComments,
  onHide,
  isHidden = false,
}) {
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
    attachedAsset,
  } = post;

  const toggleRef = useRef(null);
  const articleRef = useRef(null);
  const systemNotePillRef = useRef(null);

  useLayoutEffect(() => {
    const btn = toggleRef.current;
    const article = articleRef.current;
    if (!btn || !article) return;

    if (!isCommentsOpen) {
      btn.style.transform = '';
      btn.style.willChange = '';
      return;
    }

    const btnRect = btn.getBoundingClientRect();
    const articleRect = article.getBoundingClientRect();

    const targetX = articleRect.left + articleRect.width / 2;
    // Half of .posts-tab --posts-stack-gap; nudge icon down to straddle the capsule seam.
    const targetY = articleRect.bottom + 24;

    const currentX = btnRect.left + btnRect.width / 2;
    const currentY = btnRect.top + btnRect.height / 2;

    const dx = targetX - currentX;
    const dy = targetY - currentY;

    btn.style.willChange = 'transform';
    btn.style.transform = `translate(${dx}px, ${dy}px) scale(1.35)`;
  }, [isCommentsOpen]);

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
    <>
      <article
        ref={articleRef}
        className={`post-card${attachedAsset ? ' post-card--has-attachment' : ''}${animateEnter ? ' post-card--feed-enter' : ''}${isCommentsOpen ? ' post-card--comments-open' : ''}${isHidden ? ' post-card--hidden' : ''}`}
        data-persona={post.persona}
        style={{
          '--post-accent': noteColor,
        }}
      >
        <div
          className="post-pill-slot post-pill-slot--top post-pill-slot--left"
          role="group"
          aria-label="Post actions"
        >
          {onHide ? (
            <button
              type="button"
              className="post-meta-pill post-action-btn post-action-btn--outline"
              onClick={() => onHide(systemNotePillRef.current?.getBoundingClientRect() ?? null)}
              aria-label={isHidden ? 'Show post' : 'Hide post'}
              aria-pressed={isHidden}
            >
              <HideIcon hidden={isHidden} />
              {isHidden ? 'Show' : 'Hide'}
            </button>
          ) : null}
        </div>
        <div
          className="post-pill-slot post-pill-slot--top post-pill-slot--center"
          aria-hidden
        />
        <div className="post-pill-slot post-pill-slot--top post-pill-slot--right">
          <span className="post-meta-pill post-outline-pill">analyze</span>
        </div>

        <div className="post-card-body">
          <div className={attachedAsset ? 'post-composite' : undefined}>
            <div className="post-card-bubble">
              <div className="post-card-head">
                <div className="post-avatar" aria-hidden>
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

            {attachedAsset?.kind === 'image' ? (
              <PostImage asset={attachedAsset} accentColor={noteColor} />
            ) : null}
            {attachedAsset?.kind === 'document' ? (
              isPdfDocumentAsset(attachedAsset) ? (
                <Suspense
                  fallback={
                    <div className="post-attachment-block post-image-halftone post-pdf-carousel">
                      <div className="post-pdf-carousel__frame">
                        <div className="post-pdf-carousel__placeholder" aria-hidden>
                          <span className="post-pdf-carousel__placeholder-label">pdf</span>
                        </div>
                      </div>
                    </div>
                  }
                >
                  <PostPdfCarousel asset={attachedAsset} accentColor={noteColor} />
                </Suspense>
              ) : (
                <PostDocument asset={attachedAsset} />
              )
            ) : null}
          </div>
        </div>

        <div
          className="post-pill-slot post-pill-slot--bottom post-pill-slot--left post-meta-left"
          aria-label="Post metadata"
        >
          <span className="post-meta-pill">{timeAgo} ago</span>
        </div>
        <div className="post-pill-slot post-pill-slot--bottom post-pill-slot--center post-meta-center">
          <span ref={systemNotePillRef} className="post-meta-pill">
            System note [{personaLabel}] [+{systemDeltaPct}%]
          </span>
        </div>
        <div className="post-pill-slot post-pill-slot--bottom post-pill-slot--right post-meta-right">
          <CommentsToggle
            ref={toggleRef}
            isOpen={isCommentsOpen}
            onToggle={onToggleComments}
            controlsId={`commenting-${post.id}`}
          />
        </div>
      </article>
      <CommentsCapsule
        post={post}
        isOpen={isCommentsOpen}
        capsuleId={`commenting-${post.id}`}
        displayName={displayName}
        handle={handle}
        avatarSrc={avatarSrc}
        avatarInitials={avatarInitials}
      />
    </>
  );
}
