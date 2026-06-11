import { lazy, memo, Suspense, useEffect, useRef } from 'react';
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
import {
  avatarSrcFromProfile,
  displayNameFromProfile,
  initialsFromProfile,
  machineHandleFromProfile,
  resolveDominantPersonaKey,
} from '@/lib/profileUtils.js';
import PersonaBadge from '@/features/identity/PersonaBadge.jsx';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';
import ProfileNameLink from '@/features/profile/ProfileNameLink.jsx';

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

function CompliantPersonaChangeLead({ change, fallbackContent, onOpenProfile }) {
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
      Due to behavior on COMPLIANT,{' '}
      <ProfileNameLink onOpenProfile={onOpenProfile} ariaLabel={`View ${userDisplayName}'s profile`}>
        {userDisplayName}
      </ProfileNameLink>
      &apos;s main persona changed from{' '}
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

function CompliantJoinLead({ notice, fallbackContent, onOpenProfile }) {
  if (!notice) {
    return <p className="post-lead post-lead--compliant-join">{fallbackContent}</p>;
  }

  const { userDisplayName } = notice;

  return (
    <p className="post-lead post-lead--compliant-join">
      COMPLIANT notice for{' '}
      <ProfileNameLink onOpenProfile={onOpenProfile} ariaLabel={`View ${userDisplayName}'s profile`}>
        {userDisplayName}
      </ProfileNameLink>
      : this profile is now active on the platform. Machine
      data from their device has been linked to their public identity.
    </p>
  );
}

function CompliantLowScoreLead({ notice, fallbackContent, onOpenProfile }) {
  if (!notice) {
    return <p className="post-lead post-lead--compliant-low-score">{fallbackContent}</p>;
  }

  const { userDisplayName, personaLabel, score, uiPersonaKey } = notice;
  const accent = personaUiColor(uiPersonaKey);

  return (
    <p className="post-lead post-lead--compliant-low-score">
      COMPLIANT notice for{' '}
      <ProfileNameLink onOpenProfile={onOpenProfile} ariaLabel={`View ${userDisplayName}'s profile`}>
        {userDisplayName}
      </ProfileNameLink>
      : your{' '}
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

function PostCard({
  post,
  isCommentsOpen = false,
  onToggleComments,
  onHide,
  onTellMeMore,
  onOpenProfile,
  leaderboardDirectorySlugs = [],
  tellMeMoreActive = false,
  isHidden = false,
  isRevealing = false,
  hidePills = false,
  /** 'meta' | 'bottom-only' | 'none' — landing mock uses bottom-only */
  pillsMode,
  isHighlightable = false,
  isHighlighted = false,
  onHighlight,
  /** Logged-in viewer profile for hosted AI comment suggestions */
  commenterProfile = null,
  aiSuggestionsEnabled = true,
  realComments = null,
  onCommentPosted,
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
    compliantJoin,
  } = post;

  const isCompliantPersonaChange = Boolean(compliantPersonaChange);
  const isCompliantLowScore = Boolean(compliantLowScore);
  const isCompliantJoin = Boolean(compliantJoin);
  const isCompliantSystemPost = isCompliantPersonaChange || isCompliantLowScore || isCompliantJoin;
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

  const openAuthorProfile = onOpenProfile
    ? () => onOpenProfile('profile', authorSlug)
    : undefined;

  const resolvedCommenter = commenterProfile
    ? {
        displayName: displayNameFromProfile(commenterProfile),
        handle: machineHandleFromProfile(commenterProfile),
        avatarSrc: avatarSrcFromProfile(commenterProfile),
        avatarInitials: initialsFromProfile(commenterProfile),
        personaBadgePersona: resolveDominantPersonaKey(commenterProfile),
      }
    : DEMO_OTHER_COMMENTER;

  return (
    <article
      ref={cardRef}
      className={`post-card${attachedAsset ? ' post-card--has-attachment' : ''}${leaderboard ? ' post-card--has-leaderboard' : ''}${isCompliantSystemPost ? ' post-card--compliant-persona-change' : ''}${isCompliantLowScore ? ' post-card--compliant-low-score' : ''}${isCompliantJoin ? ' post-card--compliant-join' : ''}${!hasLeadContent ? ' post-card--empty-lead' : ''}${isCommentsOpen ? ' post-card--comments-open' : ''}${isHidden ? ' post-card--hidden' : ''}${isRevealing ? ' post-card--revealing' : ''}${resolvedPillsMode === 'none' ? ' post-card--no-pills' : ''}${resolvedPillsMode === 'bottom-only' ? ' post-card--bottom-pills-only' : ''}${isHighlightable ? ' post-card--highlightable' : ''}${isHighlighted ? ' post-card--highlighted' : ''}`}
      data-post-id={post.id}
      data-persona={post.persona}
      style={{ '--post-accent': noteColor }}
      onClick={isHighlightable ? (e) => {
        if (e.target.closest(
          'button, a, [role="button"], .post-card-meta-row, .post-action-btn, .post-meta-pill',
        )) return;
        onHighlight?.();
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
                onOpenProfile={openAuthorProfile}
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
                  onOpenProfile={openAuthorProfile}
                />
              ) : isCompliantLowScore ? (
                <CompliantLowScoreLead
                  notice={compliantLowScore}
                  fallbackContent={content}
                  onOpenProfile={openAuthorProfile}
                />
              ) : isCompliantJoin ? (
                <CompliantJoinLead
                  notice={compliantJoin}
                  fallbackContent={content}
                  onOpenProfile={openAuthorProfile}
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
                  {personaLabel} [+{systemDeltaPct}%]
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
            leaderboardDirectorySlugs={leaderboardDirectorySlugs}
          />
        ) : null}

        {showCommentsCapsule ? (
          <CommentsCapsule
            post={post}
            isOpen={isCommentsOpen}
            onToggle={onToggleComments}
            timeLabel={`${timeAgo} ago`}
            systemNoteLabel={`${personaLabel} [+${systemDeltaPct}%]`}
            capsuleId={`commenting-${post.id}`}
            displayName={displayName}
            handle={handle}
            avatarSrc={avatarSrc}
            avatarInitials={avatarInitials}
            personaBadgePersona={personaBadgePersona ?? persona}
            commenterDisplayName={resolvedCommenter.displayName}
            commenterHandle={resolvedCommenter.handle}
            commenterAvatarSrc={resolvedCommenter.avatarSrc}
            commenterAvatarInitials={resolvedCommenter.avatarInitials}
            commenterPersonaBadgePersona={resolvedCommenter.personaBadgePersona}
            commenterProfile={commenterProfile}
            aiSuggestionsEnabled={aiSuggestionsEnabled}
            realComments={realComments}
            onCommentPosted={onCommentPosted}
            onOpenProfile={openAuthorProfile}
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
                  e.preventDefault();
                  e.stopPropagation();
                  onHide();
                }}
              />
            ) : null}
            {onTellMeMore ? (
              <PostTellMeMoreToggle
                isActive={tellMeMoreActive}
                onClick={(e) => {
                  e.preventDefault();
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

// `buildEnrichedPosts` creates fresh attachedAsset/leaderboard objects on
// every parent render, so referential equality fails even when nothing
// meaningful changed. Compare by content fields for those.
function attachedAssetEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.url === b.url && a.kind === b.kind && a.filename === b.filename;
}

function leaderboardEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.boardId !== b.boardId) return false;
  if (a.userRank !== b.userRank) return false;
  if (a.previousUserRank !== b.previousUserRank) return false;
  if (!Array.isArray(a.entries) || !Array.isArray(b.entries)) return false;
  if (a.entries.length !== b.entries.length) return false;
  for (let i = 0; i < a.entries.length; i += 1) {
    const x = a.entries[i];
    const y = b.entries[i];
    if (x === y) continue;
    if (!x || !y) return false;
    if (x.slug !== y.slug || x.score !== y.score || x.avatarSrc !== y.avatarSrc) {
      return false;
    }
  }
  return true;
}

function postShallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id
    && a.content === b.content
    && a.persona === b.persona
    && a.noteColor === b.noteColor
    && a.displayName === b.displayName
    && a.handle === b.handle
    && a.avatarSrc === b.avatarSrc
    && a.avatarInitials === b.avatarInitials
    && a.authorSlug === b.authorSlug
    && a.personaBadgePersona === b.personaBadgePersona
    && a.createdAt === b.createdAt
    && a.systemDeltaPct === b.systemDeltaPct
    && a.chartType === b.chartType
    && attachedAssetEqual(a.attachedAsset, b.attachedAsset)
    && leaderboardEqual(a.leaderboard, b.leaderboard)
    && a.inferenceChain === b.inferenceChain
    && a.ingredients === b.ingredients
    && a.highlights === b.highlights
    && a.thinking === b.thinking
    && a.compliantPersonaChange === b.compliantPersonaChange
    && a.compliantLowScore === b.compliantLowScore
    && a.compliantJoin === b.compliantJoin
  );
}

// Callbacks (onToggleComments, onHide, …) are inline arrows recreated on
// every parent render. They close over stable setters + `post.id`, so their
// identity changes are irrelevant to what the card visually displays. Skip
// them here; the visible behaviour depends only on the props below.
function arePostCardPropsEqual(prev, next) {
  return (
    prev.isCommentsOpen === next.isCommentsOpen
    && prev.isHidden === next.isHidden
    && prev.isRevealing === next.isRevealing
    && prev.hidePills === next.hidePills
    && prev.pillsMode === next.pillsMode
    && prev.isHighlightable === next.isHighlightable
    && prev.isHighlighted === next.isHighlighted
    && prev.tellMeMoreActive === next.tellMeMoreActive
    && prev.aiSuggestionsEnabled === next.aiSuggestionsEnabled
    && prev.commenterProfile === next.commenterProfile
    && postShallowEqual(prev.post, next.post)
  );
}

export default memo(PostCard, arePostCardPropsEqual);
