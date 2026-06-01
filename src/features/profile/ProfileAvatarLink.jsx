import { useEffect, useRef, useState } from 'react';
import UserSilhouetteIcon from '@/features/identity/UserSilhouetteIcon.jsx';

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
  const [imgSrc, setImgSrc] = useState(avatarSrc);
  const [imgFailed, setImgFailed] = useState(false);
  const retriedRef = useRef(false);

  useEffect(() => {
    setImgSrc(avatarSrc);
    setImgFailed(false);
    retriedRef.current = false;
  }, [avatarSrc]);

  const showImg = Boolean(imgSrc) && !imgFailed;

  const inner = (
    <>
      {showImg ? (
        <img
          className={imgClassName}
          src={imgSrc}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => {
            if (!retriedRef.current && /^https?:\/\//i.test(String(imgSrc || ''))) {
              retriedRef.current = true;
              const base = String(imgSrc).split('?')[0];
              setImgSrc(`${base}?retry=${Date.now()}`);
              return;
            }
            setImgFailed(true);
          }}
        />
      ) : (
        <UserSilhouetteIcon className={initialsClassName} />
      )}
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
