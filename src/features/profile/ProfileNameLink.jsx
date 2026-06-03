/**
 * Inline clickable display name — opens a profile via onOpenProfile.
 */
export default function ProfileNameLink({
  className = '',
  onOpenProfile,
  ariaLabel,
  children,
}) {
  if (!onOpenProfile || children == null || children === '') {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      type="button"
      className={`profile-name-link ${className}`.trim()}
      aria-label={ariaLabel ?? (typeof children === 'string' ? `View ${children}'s profile` : 'View profile')}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenProfile();
      }}
    >
      {children}
    </button>
  );
}
