const RING_RADIUS = 35;
const RING_CX = 40;
const RING_CY = 40;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function Arc({ value, color, label, description }) {
  const offset = CIRCUMFERENCE * (1 - value / 100);
  return (
    <div className="po-ring-item" title={description}>
      <svg className="po-ring-svg" viewBox="0 0 80 80" width="80" height="80">
        <circle
          cx={RING_CX} cy={RING_CY} r={RING_RADIUS}
          fill="none" stroke="var(--panel-muted, #eceae7)" strokeWidth="8"
        />
        <circle
          cx={RING_CX} cy={RING_CY} r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${RING_CX}px ${RING_CY}px` }}
        />
        <text
          x={RING_CX} y={RING_CY}
          textAnchor="middle" dominantBaseline="central"
          fontSize="16" fontWeight="800"
          fill={color}
          fontFamily="var(--font-sans)"
        >
          {value}
        </text>
      </svg>
      <span className="po-ring-label" style={{ color }}>{label}</span>
    </div>
  );
}

export default function ScoreBreakdown({ scores }) {
  const trendUp = scores.trend.startsWith('+');
  return (
    <div className="po-card po-scores">
      <p className="po-card-title">Behavioral Score</p>

      <div className="po-score-center">
        <svg viewBox="0 0 120 120" width="120" height="120" className="po-score-main-svg">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--panel-muted, #eceae7)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke="var(--persona-accent, #2323ff)"
            strokeWidth="10"
            strokeDasharray={2 * Math.PI * 50}
            strokeDashoffset={2 * Math.PI * 50 * (1 - scores.overall / 100)}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
          />
          <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
            fontSize="32" fontWeight="800" fill="var(--ink, #000)"
            fontFamily="var(--font-sans)">
            {scores.overall}
          </text>
        </svg>
        <div className="po-score-meta">
          <span className="po-pill po-pill--accent" style={{ fontSize: 13 }}>
            {trendUp ? '↑' : '↓'} {scores.trend} this week
          </span>
          <p className="po-secondary" style={{ marginTop: 6 }}>
            Rank <strong>#{scores.rank_position.toLocaleString()}</strong> of {scores.rank_total.toLocaleString()} users
          </p>
        </div>
      </div>

      <hr className="po-divider" />

      <div className="po-ring-row">
        <Arc value={scores.productivity} color="#2323FF" label="Productivity" description="Code output, file modifications, active hours" />
        <Arc value={scores.security} color="#FF4E00" label="Security" description="SIP, FileVault, Gatekeeper, update compliance" />
        <Arc value={scores.social} color="#0FA020" label="Social" description="Network exposure, communication apps, public activity" />
      </div>
    </div>
  );
}
