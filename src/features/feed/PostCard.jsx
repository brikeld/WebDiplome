import { lazy, Suspense, useEffect, useRef } from 'react';
import PostImage from './PostImage.jsx';
import PostDocument from './PostDocument.jsx';
import LeaderboardBlock from './LeaderboardBlock.jsx';
import { isPdfDocumentAsset } from '@/lib/attachmentKind.js';
import { shouldApplyPostImageFx } from '@/lib/shouldApplyPostImageFx.js';
import CommentsToggle from '@/features/commenting/CommentsToggle.jsx';
import PostHideToggle from '@/features/feed/PostHideToggle.jsx';
import PostTellMeMoreToggle from '@/features/feed/PostTellMeMoreToggle.jsx';
import CommentsCapsule from '@/features/commenting/CommentsCapsule.jsx';
import { DEMO_OTHER_COMMENTER } from '@/lib/demoCommentIdentity.js';
import PersonaBadge from '@/features/identity/PersonaBadge.jsx';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';

const PostPdfCarousel = lazy(() => import('./PostPdfCarousel.jsx'));

const PERSONA_UI_COLORS = {
  productivity: '#D8D8D8',
  productivite: '#D8D8D8',
  security: '#759AEF',
  securite: '#759AEF',
  popularity: '#CCF847',
  popularite: '#CCF847',
  social: '#CCF847',
};

function personaUiColor(key) {
  return PERSONA_UI_COLORS[String(key ?? '').toLowerCase()] ?? '#fff';
}

function CompliantPersonaChangeLead({ change, fallbackContent }) {
  if (!change) {
    return <p className="post-lead post-lead--compliant-persona-change">{fallbackContent}</p>;
  }

  const {
    userDisplayName,
    fromLabel,
    toLabel,
    fromPersona,
    toPersona,
  } = change;

  return (
    <p className="post-lead post-lead--compliant-persona-change">
      Due to behavior on COMPLIANT, {userDisplayName}&apos;s main persona changed from{' '}
      <span
        className="post-persona-label"
        style={{ color: personaUiColor(fromPersona) }}
      >
        {fromLabel}
      </span>
      {' '}to{' '}
      <span
        className="post-persona-label"
        style={{ color: personaUiColor(toPersona) }}
      >
        {toLabel}
      </span>
      .
    </p>
  );
}

function CompliantLowScoreLead({ notice, fallbackContent }) {
  if (!notice) {
    return <p className="post-lead post-lead--compliant-low-score">{fallbackContent}</p>;
  }

  const { userDisplayName, personaLabel, score, uiPersonaKey } = notice;
  const accent = personaUiColor(uiPersonaKey);

  return (
    <p className="post-lead post-lead--compliant-low-score">
      COMPLIANT notice for {userDisplayName}: your{' '}
      <span className="post-persona-label" style={{ color: accent }}>
        {personaLabel}
      </span>
      {' '}score is at{' '}
      <span className="post-persona-label" style={{ color: accent }}>
        {score}%
      </span>
      . That is below the minimum the system expects. Some features are limited until you
      improve this persona.
    </p>
  );
}

export default function PostCard({
  post,
  isCommentsOpen = false,
  onToggleComments,
  onHide,
  onTellMeMore,
  onOpenProfile,
  tellMeMoreActive = false,
  isHidden = false,
  isRevealing = false,
  hidePills = false,
  /** 'meta' | 'bottom-only' | 'none' — landing mock uses bottom-only */
  pillsMode,
  isHighlightable = false,
  isHighlighted = false,
  onHighlight,
}) {
  const {
    content,
    noteColor,
    displayName,
    handle,
    avatarInitials,
    avatarSrc,
    authorSlug,
    personaBadgePersona,
    createdAt,
    systemDeltaPct = 1,
    persona,
    attachedAsset,
    chartType,
    leaderboard,
    compliantPersonaChange,
    compliantLowScore,
  } = post;

  const isCompliantPersonaChange = Boolean(compliantPersonaChange);
  const isCompliantLowScore = Boolean(compliantLowScore);
  const isCompliantSystemPost = isCompliantPersonaChange || isCompliantLowScore;
  const applyImageFx = shouldApplyPostImageFx({ chartType });
  const hasLeadContent = Boolean(String(content ?? '').trim());

  const systemNotePillRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  const resolvedPillsMode = pillsMode ?? (hidePills ? 'none' : 'meta');
  const showBottomMeta =
    !isCompliantSystemPost &&
    (resolvedPillsMode === 'meta' || resolvedPillsMode === 'bottom-only');
  const showCommentsCapsule = !isCompliantSystemPost && resolvedPillsMode !== 'bottom-only';

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
      ref={cardRef}
      className={`post-card${attachedAsset ? ' post-card--has-attachment' : ''}${leaderboard ? ' post-card--has-leaderboard' : ''}${isCompliantSystemPost ? ' post-card--compliant-persona-change' : ''}${isCompliantLowScore ? ' post-card--compliant-low-score' : ''}${!hasLeadContent ? ' post-card--empty-lead' : ''}${isCommentsOpen ? ' post-card--comments-open' : ''}${isHidden ? ' post-card--hidden' : ''}${isRevealing ? ' post-card--revealing' : ''}${resolvedPillsMode === 'none' ? ' post-card--no-pills' : ''}${resolvedPillsMode === 'bottom-only' ? ' post-card--bottom-pills-only' : ''}${isHighlightable ? ' post-card--highlightable' : ''}${isHighlighted ? ' post-card--highlighted' : ''}`}
      data-post-id={post.id}
      data-persona={post.persona}
      style={{ '--post-accent': noteColor }}
      onClick={isHighlightable ? (e) => {
        if (!e.target.closest('button, a, [role="button"]')) onHighlight?.();
      } : undefined}
    >
      <div className="post-unified-capsule">
        <div className="post-card-bubble">
          <div className="post-card-head">
            {isCompliantSystemPost ? (
              <div className="post-avatar" aria-hidden>
                <span className="post-avatar-compliant-logo">COMPLIANT</span>
              </div>
            ) : (
              <ProfileAvatarLink
                className="post-avatar"
                imgClassName="post-avatar-img"
                onOpenProfile={
                  onOpenProfile ? () => onOpenProfile('profile', authorSlug) : undefined
                }
                ariaLabel={`View ${displayName}'s profile`}
                avatarSrc={avatarSrc}
                avatarInitials={avatarInitials}
              >
                <PersonaBadge persona={personaBadgePersona ?? persona} />
              </ProfileAvatarLink>
            )}
            <div className="post-card-lead">
              {isCompliantPersonaChange ? (
                <CompliantPersonaChangeLead
                  change={compliantPersonaChange}
                  fallbackContent={content}
                />
              ) : isCompliantLowScore ? (
                <CompliantLowScoreLead
                  notice={compliantLowScore}
                  fallbackContent={content}
                />
              ) : (
                <p className="post-lead">{content}</p>
              )}
            </div>
            <div className="post-card-footer">
              <div className="post-card-byline">
                <p className="post-card-name">{displayName}</p>
                {handle ? <p className="post-card-handle">{handle}</p> : null}
              </div>
              {!isCompliantSystemPost ? (
                <span ref={systemNotePillRef} className="post-system-note-pill">
                  System note [{personaLabel}] [+{systemDeltaPct}%]
                </span>
              ) : null}
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
                <div
                  className="post-attachment-block post-image-plain post-pdf-carousel"
                  style={{ '--post-accent': noteColor }}
                >
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

        {leaderboard ? (
          <LeaderboardBlock
            leaderboard={leaderboard}
            accentColor={noteColor}
            authorSlug={authorSlug}
            onOpenProfile={onOpenProfile}
          />
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
            personaBadgePersona={personaBadgePersona ?? persona}
            commenterDisplayName={DEMO_OTHER_COMMENTER.displayName}
            commenterHandle={DEMO_OTHER_COMMENTER.handle}
            commenterAvatarSrc={DEMO_OTHER_COMMENTER.avatarSrc}
            commenterAvatarInitials={DEMO_OTHER_COMMENTER.avatarInitials}
            commenterPersonaBadgePersona={DEMO_OTHER_COMMENTER.personaBadgePersona}
            onOpenProfile={onOpenProfile}
          />
        ) : null}
      </div>

      {showBottomMeta ? (
        <div className="post-card-meta-row" aria-label="Post metadata">
          <div className="post-card-meta-row__actions">
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
            {onHide ? (
              <PostHideToggle
                isHidden={isHidden}
                onClick={(e) => {
                  e.stopPropagation();
                  onHide();
                }}
              />
            ) : null}
            {onTellMeMore ? (
              <PostTellMeMoreToggle
                isActive={tellMeMoreActive}
                onClick={(e) => {
                  e.stopPropagation();
                  onTellMeMore();
                }}
              />
            ) : null}
          </div>
          <span className="post-meta-pill post-meta-pill--time">{timeAgo} ago</span>
        </div>
      ) : null}
    </article>
  );
}
