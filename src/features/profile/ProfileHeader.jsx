import { displayNameFromProfile, getGlobalScore, profileBioText } from '@/lib/profileUtils.js';

export default function ProfileHeader({
  profile,
  personaKey = 'productivity',
  personaColor = 'var(--prod)',
  showTopHandle = true,
}) {
  const name = displayNameFromProfile(profile ?? {});
  const handle = profile?.machineName ? `@${profile.machineName}` : '@—';
  const score = getGlobalScore(profile ?? {}) ?? 76;

  const bio = profileBioText(profile ?? {});

  return (
    <>
      <div className="profile-header-stack">
        {showTopHandle ? (
          <div className="profile-top-handle" aria-label="Profile handle">
            {handle}
          </div>
        ) : null}
        <div className="profile-hero-capsule">
          <div className="profile-hero-main">
            <div className="profile-hero-left">
              <div className="profile-name-row">
                <div className="profile-name-lg">{name}</div>
              </div>
              <div className="profile-handle-row">
                <div className="profile-handle-lg">{handle}</div>
                <button
                  type="button"
                  className="profile-connect-btn"
                  style={{
                    backgroundColor: personaColor,
                    color: personaKey === 'popularity' ? '#000' : '#fff',
                  }}
                >
                  connect
                </button>
              </div>

              <p className="profile-bio">{bio || '—'}</p>
            </div>

            <div
              className="profile-score-avatar"
              aria-label={`Score ${score}`}
            >
              <span className="profile-score-avatar-num">{score}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
