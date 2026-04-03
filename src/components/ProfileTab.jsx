import DonutChart from './charts/DonutChart.jsx';
import ScoreGauge from './charts/ScoreGauge.jsx';

export default function ProfileTab() {
  return (
    <div>
      <div className="time-section">
        <div className="time-block">
          <div className="time-value">03 days &amp; 17 hours</div>
          <div className="time-label">From last update</div>
        </div>
        <div className="profile-badges">
          <div className="profile-badge">
            <div className="profile-badge-circle" style={{ background: '#2323FF' }}>
              badge1
            </div>
            <div className="profile-badge-name">Off the Grid</div>
          </div>
          <div className="profile-badge">
            <div
              className="profile-badge-circle lime-badge"
              style={{ background: '#CEFE46' }}
            >
              badge2
            </div>
            <div className="profile-badge-name">Multilingual</div>
          </div>
          <div className="profile-badge">
            <div className="profile-badge-circle" style={{ background: '#FF4E00' }}>
              badge3
            </div>
            <div className="profile-badge-name">Lone wolf</div>
          </div>
        </div>
      </div>

      <div className="hr" />

      <div className="gauges-row">
        <ScoreGauge color="#2323FF" direction="down" label="Productivity" fillPercent={0.6} />
        <ScoreGauge color="#FF4E00" direction="down" label="Security" fillPercent={0.45} />
        <ScoreGauge color="#CEFE46" direction="up" label="Popularity" fillPercent={0.72} />
      </div>

      <div className="hr" />

      <div className="donut-section">
        <h3>Most used apps</h3>
        <div className="donut-row">
          <ul className="app-list">
            {['cursor', 'blender', 'photoshop', 'notes', 'chatgpt', 'figma'].map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <DonutChart />
        </div>
      </div>
    </div>
  );
}

