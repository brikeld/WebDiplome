import { lazy, Suspense, useRef } from 'react';
import PostImage from './PostImage.jsx';
import PostDocument from './PostDocument.jsx';
import { isPdfDocumentAsset } from '@/lib/attachmentKind.js';
import { shouldApplyPostImageFx } from '@/lib/shouldApplyPostImageFx.js';
import CommentsToggle from '@/features/commenting/CommentsToggle.jsx';
import CommentsCapsule from '@/features/commenting/CommentsCapsule.jsx';
import { DEMO_OTHER_COMMENTER } from '@/lib/demoCommentIdentity.js';

const PostPdfCarousel = lazy(() => import('./PostPdfCarousel.jsx'));

export default function PostCard({
  post,
  animateEnter = false,
  isCommentsOpen = false,
  onToggleComments,
  /** Reserved for a future hide control (dashboard HIDE uses the same flow today). */
  onHide: _onHide,
  isHidden = false,
  hidePills = false,
  /** 'meta' | 'bottom-only' | 'none' — landing mock uses bottom-only */
  pillsMode,
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
    chartType,
  } = post;

  const applyImageFx = shouldApplyPostImageFx({ chartType });
  const hasLeadContent = Boolean(String(content ?? '').trim());

  const systemNotePillRef = useRef(null);

  const resolvedPillsMode = pillsMode ?? (hidePills ? 'none' : 'meta');
  const showBottomMeta =
    resolvedPillsMode === 'meta' || resolvedPillsMode === 'bottom-only';
  const showCommentsCapsule = resolvedPillsMode !== 'bottom-only';

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

  return (
    <article
      className={`post-card${attachedAsset ? ' post-card--has-attachment' : ''}${!hasLeadContent ? ' post-card--empty-lead' : ''}${animateEnter ? ' post-card--feed-enter' : ''}${isCommentsOpen ? ' post-card--comments-open' : ''}${isHidden ? ' post-card--hidden' : ''}${resolvedPillsMode === 'none' ? ' post-card--no-pills' : ''}${resolvedPillsMode === 'bottom-only' ? ' post-card--bottom-pills-only' : ''}`}
      data-persona={post.persona}
      style={{
        '--post-accent': noteColor,
      }}
    >
      <div className="post-unified-capsule">
        <div className="post-card-bubble">
          <div className="post-card-head">
            <div className="post-avatar" aria-hidden>
              {avatarSrc ? <img className="post-avatar-img" src={avatarSrc} alt="" /> : avatarInitials}
            </div>
            <div className="post-card-lead">
              <p className="post-lead">{content}</p>
            </div>
            <div className="post-card-footer">
              <div className="post-card-byline">
                <p className="post-card-name">{displayName}</p>
                {handle ? <p className="post-card-handle">{handle}</p> : null}
              </div>
              <span ref={systemNotePillRef} className="post-system-note-pill">
                System note [{personaLabel}] [+{systemDeltaPct}%]
              </span>
            </div>
          </div>
        </div>

        {attachedAsset?.kind === 'image' ? (
          <PostImage asset={attachedAsset} accentColor={noteColor} applyFx={applyImageFx} />
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

        {showCommentsCapsule ? (
          <CommentsCapsule
            post={post}
            isOpen={isCommentsOpen}
            onToggle={onToggleComments}
            timeLabel={`${timeAgo} ago`}
            systemNoteLabel={`System note [${personaLabel}] [+${systemDeltaPct}%]`}
            capsuleId={`commenting-${post.id}`}
            displayName={displayName}
            handle={handle}
            avatarSrc={avatarSrc}
            avatarInitials={avatarInitials}
            commenterDisplayName={DEMO_OTHER_COMMENTER.displayName}
            commenterHandle={DEMO_OTHER_COMMENTER.handle}
            commenterAvatarSrc={DEMO_OTHER_COMMENTER.avatarSrc}
            commenterAvatarInitials={DEMO_OTHER_COMMENTER.avatarInitials}
          />
        ) : null}
      </div>

      {showBottomMeta ? (
        <div className="post-card-meta-row" aria-label="Post metadata">
          {resolvedPillsMode === 'bottom-only' ? (
            <span className="post-meta-pill post-meta-pill--comment" aria-hidden>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5l-3.7 2.8A.6.6 0 0 1 5 17.4V15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
              </svg>
            </span>
          ) : (
            <CommentsToggle
              isOpen={isCommentsOpen}
              onToggle={onToggleComments}
              controlsId={`commenting-${post.id}`}
            />
          )}
          <span className="post-meta-pill">{timeAgo} ago</span>
        </div>
      ) : null}
    </article>
  );
}
