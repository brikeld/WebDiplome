function activityLevels(daysOrder) {
  const total = daysOrder.length;
  return daysOrder.map((day, i) => ({
    day: day.slice(0, 3),
    level: parseFloat((1 - (i / (total - 1)) * 0.85).toFixed(2)),
  }));
}

function hourToFraction(timeStr) {
  const match = timeStr.match(/(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  if (match[2].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[2].toUpperCase() === 'AM' && h === 12) h = 0;
  return h / 24;
}

function PeakStrip({ label, range }) {
  const [start, end] = range.split(' - ');
  const s = hourToFraction(start.trim());
  let e = hourToFraction(end.trim());
  if (e < s) e = 1;
  const left = `${(s * 100).toFixed(1)}%`;
  const width = `${((e - s) * 100).toFixed(1)}%`;
  return (
    <div className="po-peak-row">
      <span className="po-secondary po-peak-label">{label}</span>
      <div className="po-peak-track">
        <div className="po-peak-fill" style={{ left, width }} />
        {[0, 6, 12, 18, 24].map(h => (
          <span key={h} className="po-peak-tick" style={{ left: `${(h / 24 * 100).toFixed(1)}%` }}>
            {h === 0 ? '12a' : h === 12 ? '12p' : h === 24 ? '' : h > 12 ? `${h - 12}p` : `${h}a`}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ActivityPatterns({ activity, lastActivity }) {
  const bars = activityLevels(activity.days_order);

  return (
    <div className="po-card po-activity">
      <p className="po-card-title">Activity Patterns</p>

      <div className="po-day-bars">
        {bars.map(({ day, level }) => (
          <div key={day} className="po-day-col">
            <div className="po-day-bar-wrap">
              <div
                className="po-day-bar"
                style={{ height: `${level * 100}%` }}
                title={`${Math.round(level * 100)}% activity`}
              />
            </div>
            <span className="po-day-label">{day}</span>
          </div>
        ))}
      </div>

      <hr className="po-divider" />

      <p className="po-secondary" style={{ marginBottom: 10, fontWeight: 700, color: 'var(--ink)' }}>
        Peak hours
      </p>
      <PeakStrip label="Primary" range={activity.peak_hours.primary} />
      <PeakStrip label="Secondary" range={activity.peak_hours.secondary} />

      <hr className="po-divider" />

      <div className="po-badge-row" style={{ marginTop: 0 }}>
        <span className="po-pill">{activity.sleep_pattern}</span>
        <span className="po-pill">Uptime: {activity.uptime}</span>
        <span className="po-pill po-pill--accent">{activity.current_status}</span>
      </div>
      <p className="po-secondary" style={{ marginTop: 8 }}>
        Last activity: {lastActivity}
      </p>
    </div>
  );
}
