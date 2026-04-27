import { badgeSections } from '@/data/badges.js';

export default function BadgesTab() {
  return (
    <div>
      {badgeSections.map((section, si) => (
        <div key={si} className="badge-section">
          <h3>{section.title}</h3>
          <div className="badge-grid">
            {section.badges.map((b, bi) => (
              <div key={bi} className="badge-card">
                <div className="badge-color-rect" style={{ background: section.color }} />
                <div className="badge-card-name">{b.name}</div>
                <div className="badge-card-desc">{b.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

