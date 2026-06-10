import UserSilhouetteIcon from '@/features/identity/UserSilhouetteIcon.jsx';
import { avatarSrcFromProfile, displayNameFromProfile, initialsFromProfile } from '@/lib/profileUtils.js';
import './landingPage.css';

export default function LoginEntryPage({
  profile,
  onEnterProfile,
  onBackToLanding,
  loading = false,
}) {
  const avatarSrc = avatarSrcFromProfile(profile);
  const displayName = displayNameFromProfile(profile);
  const initials = initialsFromProfile(profile);

  return (
    <div className={`lp-login-root${loading ? ' lp-login-root--opening' : ''}`}>
      <span className="lp-login-transition" aria-hidden="true" />
      <button
        type="button"
        className="lp-login-logo"
        onClick={onBackToLanding}
        aria-label="Go to landing page"
      >
        COMPLIANT
      </button>

      <main className="lp-login-main" aria-label="Account login">
        <button
          type="button"
          className="lp-login-avatar-button"
          onClick={onEnterProfile}
          aria-label={`Open ${displayName} profile`}
          disabled={loading || !profile}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt={`${displayName} profile`} />
          ) : (
            <span className="lp-login-avatar-fallback" aria-hidden="true">
              <UserSilhouetteIcon />
              <span>{initials}</span>
            </span>
          )}
        </button>
        <button
          type="button"
          className="lp-login-text"
          onClick={onEnterProfile}
          disabled={loading || !profile}
        >
          {loading ? 'opening…' : 'enter COMPLIANT'}
        </button>
      </main>
    </div>
  );
}
