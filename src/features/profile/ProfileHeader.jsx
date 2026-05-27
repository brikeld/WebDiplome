import MainScoreStyle from '@/features/profile/MainScoreStyle.jsx';
import PersonaBadge from '@/features/identity/PersonaBadge.jsx';
import {
  avatarSrcFromProfile,
  displayNameFromProfile,
  getCenterDisplayScore,
  initialsFromProfile,
  machineHandleFromProfile,
  profileBioText,
  profilePostCount,
  profileRankingCount,
} from '@/lib/profileUtils.js';

export default function ProfileHeader({
  profile,
  personaColor = 'var(--prod)',
  personaBadgePersona = null,
  mainScoreEntryReplayKey = 0,
  onNavigateTab,
}) {
  const name = displayNameFromProfile(profile ?? {});
  const initials = initialsFromProfile(profile ?? {});
  const avatarSrc = avatarSrcFromProfile(profile);
  const handle = machineHandleFromProfile(profile ?? {});
  const centerScore = getCenterDisplayScore(profile ?? {});
  const postCount = profilePostCount(profile ?? {});
  const rankingCount = profileRankingCount(profile ?? {});

  const bio = profileBioText(profile ?? {});
  const postLabel = `${postCount} ${postCount === 1 ? 'post' : 'posts'}`;
  const rankingLabel = `${rankingCount} ${rankingCount === 1 ? 'ranking' : 'rankings'}`;

  const profilePhoto = (
    <div className="profile-ring-avatar" aria-hidden>
      {avatarSrc ? (
        <img className="profile-cap-avatar-img" src={avatarSrc} alt="" />
      ) : (
        <span className="profile-cap-avatar-initials">{initials}</span>
      )}
    </div>
  );

  return (
    <>
      <div className="profile-header-stack">
        <div className="profile-hero-capsule profile-hero-capsule--ring-avatar">
          <div className="profile-hero-main">
            <div className="profile-hero-left">
              <div className="profile-name-handle-stack">
                <div className="profile-name-row">
                  <div className="profile-name-lg">{name}</div>
                  <span className="profile-hero-badge-slot">
                    <PersonaBadge
                      persona={personaBadgePersona}
                      profile={profile ?? {}}
                      className="profile-hero-persona-badge"
                    />
                  </span>
                </div>
                <div className="profile-handle-row">
                  <div className="profile-handle-lg">{handle}</div>
                </div>
              </div>
              <div className="profile-follow-row">
                <button
                  type="button"
                  className="profile-follow-item profile-follow-item--button"
                  aria-label={`View ${postLabel}`}
                  data-profile-tab-target="posts"
                  onClick={() => onNavigateTab?.('posts')}
                >
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M4 3.5A1.5 1.5 0 0 1 5.5 2h9A1.5 1.5 0 0 1 16 3.5v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5v-13Zm3 2a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Zm0 4a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H7Z"/>
                  </svg>
                  <span className="profile-follow-num">{postCount}</span>
                </button>
                <button
                  type="button"
                  className="profile-follow-item profile-follow-item--button"
                  aria-label={`View ${rankingLabel}`}
                  data-profile-tab-target="leaderboards"
                  onClick={() => onNavigateTab?.('leaderboards')}
                >
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M5 3h10v2h2a1 1 0 0 1 1 1v1.25A4.75 4.75 0 0 1 13.25 12H13a4.05 4.05 0 0 1-2 1.84V16h3a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2h3v-2.16A4.05 4.05 0 0 1 7 12h-.25A4.75 4.75 0 0 1 2 7.25V6a1 1 0 0 1 1-1h2V3Zm0 4H4v.25A2.75 2.75 0 0 0 5.95 9.88 7.73 7.73 0 0 1 5 7V7Zm11 0h-1a7.73 7.73 0 0 1-.95 2.88A2.75 2.75 0 0 0 16 7.25V7Z"/>
                  </svg>
                  <span className="profile-follow-num">{rankingCount}</span>
                </button>
              </div>
              <p className="profile-bio">{bio ? `"${bio}"` : '—'}</p>
            </div>

            <div
              className="profile-score-avatar"
              aria-label={`Score ${centerScore}`}
              style={{ '--score-fill': personaColor }}
            >
              <MainScoreStyle
                profile={profile ?? {}}
                entryReplayKey={mainScoreEntryReplayKey}
                hideCenterScore
              />
              {profilePhoto}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
