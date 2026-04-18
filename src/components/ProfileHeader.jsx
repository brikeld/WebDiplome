import { useState, useEffect } from 'react';
import {
  displayNameFromProfile,
  formatRelativeTimeAgo,
  getGlobalScore,
  initialsFromProfile,
  profileBioText,
} from '../lib/profileUtils.js';

function lastAnalysisRaw(p) {
  return (
    p?.lastAnalysisAt ??
    p?.last_analysis_at ??
    p?.lastAnalysis ??
    p?.last_analysis ??
    p?.collectedAt ??
    p?.collected_at
  );
}

function IconBadges() {
  return (
    <svg
      className="stat-pill-icon-svg stat-pill-icon-fill"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </svg>
  );
}

/** Two lines each: [line1, line2] — always two lines in UI */
const PERSONA_LINES = {
  productivity: ['productivity', 'user'],
  security: ['security', 'user'],
  popularity: ['social', 'user'],
};

export default function ProfileHeader({
  profile,
  personaKey = 'productivity',
  personaColor = 'var(--prod)',
}) {
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTimeTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

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
  const lastRaw = profile ? lastAnalysisRaw(profile) : null;
  const lastAnalysisText = lastRaw ? formatRelativeTimeAgo(lastRaw) : '—';

  const badgesCount = profile?.badgesCount ?? profile?.badges_count ?? 11;
  const bio = profileBioText(profile ?? {});

  const [personaLine1, personaLine2] = PERSONA_LINES[personaKey] ?? [
    'user',
    'user',
  ];

  return (
    <>
      <div className="profile-header-stack">
        <div className="profile-top-handle" aria-label="Profile handle">
          {handle}
        </div>
        <div className="profile-hero-capsule">
        <div className="profile-hero-main">
          <div className="profile-hero-left">
            <div className="profile-id-row">
              <div
                className="profile-score-block"
                aria-label={`Score ${score}`}
                style={{ backgroundColor: personaColor }}
              >
                <span
                  className="profile-score-num"
                >
                  {score}
                </span>
              </div>
              <div className="profile-id-text">
                <div className="profile-name-row">
                  <div className="profile-name-lg">{name}</div>
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
                <div className="profile-handle-lg">{handle}</div>
                <div
                  className="profile-badges-row"
                  aria-label={`${badgesCount} badges`}
                  title="Badges"
                >
                  <IconBadges />
                  <span className="profile-badges-count">{badgesCount}</span>
                </div>
              </div>
            </div>

            <p className="profile-bio">{bio || '—'}</p>

            <div
              className="profile-mini-badges"
              style={{ '--badge-persona': personaColor }}
              aria-hidden
            >
              <div className="mini-badge-item">
                <div className="mini-badge" />
                <div className="mini-badge-label">the creative</div>
              </div>
              <div className="mini-badge-item">
                <div className="mini-badge" />
                <div className="mini-badge-label">the creative</div>
              </div>
              <div className="mini-badge-item">
                <div className="mini-badge" />
                <div className="mini-badge-label">the creative</div>
              </div>
            </div>
            <div className="profile-last-analysis">
              Last analysis · {lastAnalysisText}
            </div>
          </div>

          <div className="profile-hero-right">
            <div className="profile-avatar-wrap" aria-hidden>
              <div className="profile-avatar-lg">
                {avatarSrc ? (
                  <img className="profile-avatar-lg-img" src={avatarSrc} alt="" />
                ) : (
                  initials
                )}
              </div>
              <div
                className="persona-pill"
                style={{ background: personaColor }}
              >
                <span className="persona-pill-line">{personaLine1}</span>
                <span className="persona-pill-line">{personaLine2}</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
