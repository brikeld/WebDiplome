export default function ProfileHeader() {
  return (
    <div className="profile-header">
      <div className="profile-card">
        <div className="name">
          Brikeld Hoxha <span className="tag">M2 Pro</span>
        </div>
        <div className="handle">@il mio MacBook</div>
        <div className="stats">14 Connections&nbsp;&nbsp; 11 Badges</div>
        <div className="bio">
          AI Generated text that presents what type of profile this is, based on the data.
        </div>
        <div className="badge-row">
          <div className="badge-dot" style={{ background: '#2323FF' }} />
          <div className="badge-dot" style={{ background: '#FF4E00' }} />
          <div className="badge-dot" style={{ background: '#CEFE46' }} />
        </div>
      </div>

      <img className="profile-photo" src="/profile.png" alt="Profile" />

      <div className="profile-right">
        <div className="profile-actions">
          <a className="action-btn" href="#">
            Compare
          </a>
          <a className="action-btn" href="#">
            Connect
          </a>
          <a className="action-btn" href="#">
            DM
          </a>
        </div>
        <div className="profile-score-tile">76</div>
      </div>
    </div>
  );
}

