import {
  displayNameFromProfile,
  getGlobalScore,
  initialsFromProfile,
  profileBioText,
} from '@/lib/profileUtils.js';

export default function ProfileHeader({
  profile,
  personaKey = 'productivity',
  personaColor = 'var(--prod)',
}) {
  const name = displayNameFromProfile(profile ?? {});
  const initials = initialsFromProfile(profile ?? {});
  const avatarSrc =
    profile?.wallpaperBase64 ??
    profile?.wallpaper_base64 ??
    profile?.wallpaperUrl ??
    profile?.wallpaper_url ??
    profile?.wallpaper ??
    null;
  const handle = profile?.machineName ? `@${profile.machineName}` : '@—';
  const score = getGlobalScore(profile ?? {}) ?? 76;
  const followers = profile?.followers ?? profile?.followerCount ?? 0;
  const following = profile?.following ?? profile?.followingCount ?? 0;

  const bio = profileBioText(profile ?? {});

  return (
    <>
      <div className="profile-header-stack">
        <div className="profile-hero-capsule">
          <div
            className="profile-cap-avatar"
            aria-hidden
            style={{ '--cap-avatar-stroke': personaColor }}
          >
            {avatarSrc ? (
              <img className="profile-cap-avatar-img" src={avatarSrc} alt="" />
            ) : (
              <span className="profile-cap-avatar-initials">{initials}</span>
            )}
          </div>
          <div className="profile-hero-main">
            <div className="profile-hero-left">
              <div className="profile-name-handle-stack">
                <div className="profile-name-row">
                  <div className="profile-name-lg">{name}</div>
                </div>
                <div className="profile-handle-row">
                  <div className="profile-handle-lg">{handle}</div>
                  <button
                    type="button"
                    className="profile-connect-btn"
                    style={{
                      color: personaColor,
                    }}
                  >
                    connect
                  </button>
                </div>
              </div>
              <div className="profile-follow-row">
                <span className="profile-follow-item">
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-7 9a7 7 0 0 1 14 0H2z"/>
                    <path d="M13 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm1 9a7 7 0 0 0-2-4.9A5 5 0 0 1 19 15h-5z"/>
                  </svg>
                  <span className="profile-follow-num">{followers}</span>
                </span>
                <span className="profile-follow-item">
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M10 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 2.02-8 4.5V17h16v-1.5c0-2.48-3.58-4.5-8-4.5z"/>
                  </svg>
                  <span className="profile-follow-num">{following}</span>
                </span>
              </div>
              <p className="profile-bio">{bio || '—'}</p>
            </div>

            <div
              className="profile-score-avatar"
              aria-label={`Score ${score}`}
              style={{ '--score-fill': personaColor }}
            >
              <span className="profile-score-avatar-num">{score}</span>
            </div>
          </div>
        </div>

        <div
          className="profile-badge-capsule"
          style={{
            borderColor: personaColor,
            background: `color-mix(in srgb, ${personaColor} 15%, #fff)`,
          }}
        >
          <div className="profile-badge-circle" style={{ background: personaColor }} />
          <div className="profile-badge-circle" style={{ background: personaColor }} />
          <div className="profile-badge-circle" style={{ background: personaColor }} />
        </div>
      </div>
    </>
  );
}
