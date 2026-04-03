import { useState, useEffect } from 'react';

export default function ProfileHeader() {
  const [name, setName] = useState('Brikeld Hoxha');
  const [machineName, setMachineName] = useState('il mio MacBook');
  const [globalScore, setGlobalScore] = useState(76);
  const [photoSrc, setPhotoSrc] = useState('/profile.png');
  const [hardwareChip, setHardwareChip] = useState('M2 Pro');

  useEffect(() => {
    fetch('http://localhost:3001/api/profiles')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const p = data[0];
          if (p.firstname && p.lastname) setName(p.firstname + ' ' + p.lastname);
          if (p.machineName) setMachineName(p.machineName);
          if (p.globalScore != null) setGlobalScore(p.globalScore);
          if (p.wallpaperBase64) setPhotoSrc(p.wallpaperBase64);
          if (p.hardware_chip) setHardwareChip(p.hardware_chip);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="profile-header">
      <div className="profile-card">
        <div className="name">
          {name} <span className="tag">{hardwareChip}</span>
        </div>
        <div className="handle">@{machineName}</div>
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

      <img className="profile-photo" src={photoSrc} alt="Profile" />

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
        <div className="profile-score-tile">{globalScore}</div>
      </div>
    </div>
  );
}

