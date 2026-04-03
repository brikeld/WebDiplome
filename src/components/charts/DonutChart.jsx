export default function DonutChart() {
  const r = 70;
  const C = 2 * Math.PI * r;
  const sw = 35;
  const segments = [
    { pct: 35, color: '#2323FF' },
    { pct: 28, color: '#000000' },
    { pct: 22, color: '#888888' },
    { pct: 10, color: '#CEFE46' },
    { pct: 5, color: '#FF4E00' },
  ];

  let cumulative = 0;
  const rendered = segments.map((s, i) => {
    const len = (s.pct / 100) * C;
    const offset = -cumulative;
    cumulative += len;
    return (
      <circle
        key={i}
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke={s.color}
        strokeWidth={sw}
        strokeDasharray={`${len} ${C - len}`}
        strokeDashoffset={offset}
        transform="rotate(-90 100 100)"
      />
    );
  });

  const labelData = [
    { pct: 35, cumBefore: 0, textColor: '#fff' },
    { pct: 28, cumBefore: 35, textColor: '#fff' },
    { pct: 22, cumBefore: 63, textColor: '#fff' },
  ];
  const labels = labelData.map((l, i) => {
    const midPct = l.cumBefore + l.pct / 2;
    const angle = ((midPct / 100) * 360 - 90) * (Math.PI / 180);
    const lx = 100 + r * Math.cos(angle);
    const ly = 100 + r * Math.sin(angle);
    return (
      <text
        key={`lbl-${i}`}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="12"
        fontWeight="700"
        fill={l.textColor}
        fontFamily="'ABC Schengen A', system-ui, sans-serif"
      >
        {l.pct}%
      </text>
    );
  });

  return (
    <svg viewBox="0 0 200 200" width="240" height="240">
      {rendered}
      {labels}
    </svg>
  );
}

