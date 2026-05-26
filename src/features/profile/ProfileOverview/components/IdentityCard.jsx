import PersonaBadge from '@/features/identity/PersonaBadge.jsx';

function accountAge(dateStr) {
  const created = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''}`;
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function IdentityCard({ profile, identity, behavioral }) {
  return (
    <div className="po-card po-identity">
      <p className="po-card-title">Identity</p>

      <div className="po-identity-top">
        <div className="po-avatar-wrap">
          <div className="po-avatar">
            <span className="po-avatar-initials">{initials(profile.username)}</span>
            <PersonaBadge profile={profile} />
          </div>
          <span
            className="po-status-dot"
            style={{ background: profile.status === 'online' ? '#0FA020' : '#888' }}
            title={profile.status}
          />
        </div>

        <div className="po-identity-info">
          <p className="po-identity-name">{profile.username}</p>
          <p className="po-secondary">
            <span className="po-identity-label">Device</span>{' '}
            {identity.device.hostname}
          </p>
          <p className="po-secondary">
            <span className="po-identity-label">Location</span>{' '}
            {identity.location_inferred}
          </p>
          <p className="po-secondary">
            <span className="po-identity-label">Account age</span>{' '}
            {accountAge(profile.account_created)}
          </p>
          <p className="po-secondary">
            <span className="po-identity-label">Last seen</span>{' '}
            {profile.last_activity}
          </p>
        </div>
      </div>

      <div className="po-badge-row">
        {behavioral.badges.map(b => (
          <span key={b} className="po-pill">{b}</span>
        ))}
      </div>
    </div>
  );
}
