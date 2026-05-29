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
  const inner = (
    <>
      {avatarSrc ? (
        <img className={imgClassName} src={avatarSrc} alt="" />
      ) : avatarInitials != null && avatarInitials !== '' ? (
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
