import PersonaBadge from '@/features/identity/PersonaBadge.jsx';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';

export default function Comment({
  persona,
  content,
  displayName,
  avatarSrc,
  avatarInitials,
  personaBadgePersona,
  onOpenProfile,
  staggerIndex = 0,
  metaLeft,
  metaCenter,
}) {
  const metaBottom = [metaLeft, metaCenter].filter(Boolean).join(' · ');

  return (
    <div
      className="commenting-comment"
      data-persona={persona}
      style={{ transitionDelay: `${staggerIndex * 60}ms` }}
    >
      <div className="commenting-comment-head">
        <ProfileAvatarLink
          className="commenting-comment-avatar"
          imgClassName="commenting-comment-avatar-img"
          onOpenProfile={onOpenProfile ? () => onOpenProfile('profile') : undefined}
          ariaLabel={displayName ? `View ${displayName}'s profile` : 'View profile'}
          avatarSrc={avatarSrc}
          avatarInitials={avatarInitials}
        >
          <PersonaBadge persona={personaBadgePersona ?? persona} />
        </ProfileAvatarLink>
        <div className="commenting-comment-lead">
          <p className="commenting-comment-content">{content}</p>
        </div>
        <div className="commenting-comment-footer">
          <span className="commenting-comment-name">{displayName}</span>
          {metaBottom ? (
            <span className="commenting-comment-meta-inline" aria-label="Comment metadata">
              {metaBottom}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
