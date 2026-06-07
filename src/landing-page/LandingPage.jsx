import UserSilhouetteIcon from '@/features/identity/UserSilhouetteIcon.jsx';
import {
  avatarSrcFromProfile,
  getPersonaBadgeModel,
} from '@/lib/profileUtils.js';
import './landingPage.css';

function LandingHeroAccess({ profile, onEnterProfile, onRegister, profileEntryLoading }) {
  const hasProfile = Boolean(profile);

  if (hasProfile) {
    const avatarSrc = avatarSrcFromProfile(profile);
    const personaColor = getPersonaBadgeModel(profile).color;

    return (
      <div className="lp-hero-access">
        <button
          type="button"
          className={`lp-hero-access-profile${profileEntryLoading ? ' lp-hero-access-profile--loading' : ''}`}
          onClick={() => onEnterProfile?.()}
          disabled={profileEntryLoading}
          aria-busy={profileEntryLoading}
          aria-label="Enter COMPLIANT"
        >
          <span
            className={`lp-hero-avatar-box${profileEntryLoading ? ' lp-hero-avatar-box--loading' : ''}`}
            style={{
              '--lp-avatar-top': personaColor,
              '--lp-avatar-bottom': '#e88a2d',
            }}
          >
            {avatarSrc ? (
              <img className="lp-hero-avatar-img" src={avatarSrc} alt="" />
            ) : (
              <UserSilhouetteIcon className="lp-hero-avatar-initials" />
            )}
          </span>
          <span className="lp-hero-access-btn">
            {profileEntryLoading ? 'Loading…' : 'enter COMPLIANT'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="lp-hero-access">
      <button type="button" className="lp-hero-access-btn lp-hero-access-btn--solo" onClick={onRegister}>
        Register
      </button>
    </div>
  );
}

export default function LandingPage({ profile, onEnterProfile, onBrowseFeed, onRegister, profileEntryLoading }) {
  return (
    <div className="lp-root">
      <main>
        <section className="lp-screen lp-hero" style={{ '--stagger-i': 0 }}>
          <h1 className="lp-hero-title">
            <button
              type="button"
              className="lp-hero-title-link"
              onClick={() => onBrowseFeed?.()}
              aria-label="Browse the public feed"
            >
              COMPLIANT
            </button>
          </h1>
          <div className="lp-hero-footer">
            <div className="lp-hero-text">
              <h2 className="lp-hero-sub">
                Who are you really?
                <br />
                <em>Let our algorithm answer that for you.</em>
              </h2>
            </div>
            <LandingHeroAccess
              profile={profile}
              onEnterProfile={onEnterProfile}
              onRegister={onRegister}
              profileEntryLoading={profileEntryLoading}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
