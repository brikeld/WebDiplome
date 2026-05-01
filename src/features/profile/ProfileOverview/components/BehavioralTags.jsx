export default function BehavioralTags({ behavioral, lifestyle }) {
  return (
    <div className="po-card po-behavioral">
      <p className="po-card-title">Behavioral Profile</p>

      <p className="po-behavioral-type">{behavioral.profile_type}</p>
      <p className="po-secondary" style={{ marginBottom: 12 }}>
        Inferred role: <strong>{behavioral.inferred_role}</strong>
      </p>
      <p className="po-secondary" style={{ marginBottom: 16 }}>
        Work context: {behavioral.work_context}
      </p>

      <hr className="po-divider" />

      <div className="po-lifestyle-section">
        <span className="po-clue-label">Entertainment</span>
        <div className="po-badge-row" style={{ marginTop: 4 }}>
          {lifestyle.entertainment_apps.map(app => (
            <span key={app} className="po-pill">{app}</span>
          ))}
        </div>
      </div>

      <div className="po-lifestyle-section">
        <span className="po-clue-label">Health tracking</span>
        <div className="po-badge-row" style={{ marginTop: 4 }}>
          {lifestyle.health_tracking.map(app => (
            <span key={app} className="po-pill">{app}</span>
          ))}
        </div>
      </div>

      <div className="po-lifestyle-section">
        <span className="po-clue-label">Gaming</span>
        <div className="po-badge-row" style={{ marginTop: 4 }}>
          {lifestyle.gaming.map(app => (
            <span key={app} className="po-pill">{app}</span>
          ))}
        </div>
      </div>

      <hr className="po-divider" />

      <div className="po-badge-row" style={{ marginTop: 0 }}>
        {behavioral.badges.map(badge => (
          <span key={badge} className="po-pill po-pill--accent">{badge}</span>
        ))}
      </div>
    </div>
  );
}
