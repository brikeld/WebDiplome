import PersonaBadge from '@/features/identity/PersonaBadge.jsx';
import UserSilhouetteIcon from '@/features/identity/UserSilhouetteIcon.jsx';
import PersonaPill from './PersonaPill.jsx';
import KeyValue from './KeyValue.jsx';
import { PERSONA_UI_LABELS } from '@/lib/personaColors.js';

function accountAge(dateStr) {
  if (!dateStr) return '—';
  const created = new Date(dateStr);
  if (Number.isNaN(created.getTime())) return '—';
  const months =
    (new Date().getFullYear() - created.getFullYear()) * 12 +
    (new Date().getMonth() - created.getMonth());
  if (months < 1) return 'Less than a month';
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''}`;
}

function Avatar({ profile, size }) {
  return (
    <div className="po-avatar-wrap">
      <div className="po-avatar" style={size ? { width: size, height: size } : undefined}>
        {profile.avatarSrc ? (
          <img className="po-avatar-img" src={profile.avatarSrc} alt="" />
        ) : (
          <UserSilhouetteIcon className="po-avatar-fallback" aria-hidden />
        )}
        <PersonaBadge profile={profile} persona={profile.dominantPersona} />
      </div>
    </div>
  );
}

export default function IdentityCard({ profile, identity, bio, variant = 'card' }) {
  const personaLabel = PERSONA_UI_LABELS[profile.dominantPersona] ?? 'Persona';

  if (variant === 'detail') {
    return (
      <div className="po-identity-detail">
        <div className="po-identity-top">
          <Avatar profile={profile} size={104} />
          <div className="po-identity-info">
            <p className="po-identity-name">{profile.username}</p>
            <p className="po-identity-handle">@{profile.user_id}</p>
            <PersonaPill dot personaKey={profile.dominantPersona}>{personaLabel} persona</PersonaPill>
          </div>
        </div>

        <div className="po-kv-grid">
          <KeyValue label="Device" value={identity.device.hostname} />
          <KeyValue label="Chip" value={identity.device.model} />
          <KeyValue label="macOS" value={identity.device.macos_version} />
          <KeyValue label="Account age" value={accountAge(profile.account_created)} />
          <KeyValue label="Last seen" value={profile.last_activity} />
          <KeyValue label="Appearance" value={identity.ui_theme} />
        </div>

        {identity.languages?.length ? (
          <div className="po-block">
            <span className="po-block-label">System languages</span>
            <div className="po-chip-row">
              {identity.languages.map((lang) => (
                <PersonaPill key={lang}>{lang}</PersonaPill>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="po-identity">
      <div className="po-identity-top po-identity-top--solo">
        <Avatar profile={profile} />
      </div>
      {bio?.text ? (
        <blockquote className="po-bio-quote">{bio.preview || bio.text}</blockquote>
      ) : (
        <p className="po-secondary">No self-summary harvested yet.</p>
      )}
    </div>
  );
}
