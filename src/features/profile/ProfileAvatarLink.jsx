import { useEffect, useState } from 'react';

/**
 * Clickable profile portrait — navigates to the Profile view (main tab).
 */
export default function ProfileAvatarLink({
  className = '',
  imgClassName = 'profile-avatar-link__img',
  initialsClassName = 'profile-avatar-link__initials',
  onOpenProfile,
  ariaLabel = 'View profile',
  avatarSrc,
  avatarInitials,
  children,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [avatarSrc]);
  const showImg = Boolean(avatarSrc) && !imgFailed;
  const showInitials = !showImg && avatarInitials != null && avatarInitials !== '';

  const inner = (
    <>
      {showImg ? (
        <img
          className={imgClassName}
          src={avatarSrc}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : showInitials ? (
        <span className={initialsClassName}>{avatarInitials}</span>
      ) : null}
      {children}
    </>
  );

  if (!onOpenProfile) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <button
      type="button"
      className={`profile-avatar-link ${className}`.trim()}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenProfile();
      }}
    >
      {inner}
    </button>
  );
}
