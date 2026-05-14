import { lazy, Suspense, useLayoutEffect, useRef } from 'react';
import PostImage from './PostImage.jsx';
import PostDocument from './PostDocument.jsx';
import { isPdfDocumentAsset } from '@/lib/attachmentKind.js';
import CommentsToggle from '@/features/commenting/CommentsToggle.jsx';
import CommentsCapsule from '@/features/commenting/CommentsCapsule.jsx';

const PostPdfCarousel = lazy(() => import('./PostPdfCarousel.jsx'));

export default function PostCard({
  post,
  animateEnter = false,
  isCommentsOpen = false,
  onToggleComments,
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
    // .posts-tab gap is 28px; place icon centered in that gap so it has equal
    // breathing room above (post) and below (capsule).
    const targetY = articleRect.bottom + 14;

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
        className={`post-card${attachedAsset ? ' post-card--has-attachment' : ''}${animateEnter ? ' post-card--feed-enter' : ''}${isCommentsOpen ? ' post-card--comments-open' : ''}`}
        data-persona={post.persona}
        style={{
          '--post-accent': noteColor,
        }}
      >
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
            <CommentsToggle
              ref={toggleRef}
              isOpen={isCommentsOpen}
              onToggle={onToggleComments}
              controlsId={`commenting-${post.id}`}
            />
          </div>
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
