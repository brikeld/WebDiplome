export default function ScoreGauge({ color, direction, label, fillPercent }) {
  const r = 50;
  const C = 2 * Math.PI * r;
  const arcLen = C * 0.75;
  const fillLen = arcLen * fillPercent;

  return (
    <div className="gauge">
      <svg viewBox="0 0 150 115" width="150" height="115">
        <circle
          cx="75"
          cy="65"
          r={r}
          fill="none"
          stroke="#E0E0E0"
          strokeWidth="8"
          strokeDasharray={`${arcLen} ${C - arcLen}`}
          transform="rotate(135 75 65)"
          strokeLinecap="round"
        />
        <circle
          cx="75"
          cy="65"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${fillLen} ${C}`}
          transform="rotate(135 75 65)"
          strokeLinecap="round"
        />
        <text
          x="75"
          y="76"
          textAnchor="middle"
          fontSize="30"
          fontWeight="700"
          fontFamily="'ABC Schengen A', system-ui, sans-serif"
          fill={color}
        >
          {direction === 'down' ? '↓' : '↑'}
        </text>
      </svg>
      <div className="gauge-label">
        <span className="gauge-indicator" style={{ color }}>
          {direction === 'down' ? '↓' : '↑'}
        </span>
        {label}
      </div>
    </div>
  );
}

