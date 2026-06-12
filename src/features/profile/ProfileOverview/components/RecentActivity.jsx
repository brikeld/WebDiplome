import { formatRelativeTimeAgo } from '@/lib/profileUtils.js';

const WINDOW_MS = 7 * 24 * 3600 * 1000;

function recencyFraction(lastUsed) {
  const t = new Date(String(lastUsed).replace(' ', 'T')).getTime();
  if (!Number.isFinite(t)) return 0.15;
  const age = Math.max(0, Date.now() - t);
  return Math.max(0.06, 1 - Math.min(1, age / WINDOW_MS));
}

function relative(lastUsed) {
  const t = new Date(String(lastUsed).replace(' ', 'T'));
  if (Number.isNaN(t.getTime())) return String(lastUsed ?? '');
  return formatRelativeTimeAgo(t);
}

export default function RecentActivity({ activity, lastActivity }) {
  const usage = activity?.appUsage7d ?? [];
  const stats = [
    ['Files touched (7d)', activity?.recentFilesCount],
    ['Downloads', activity?.downloadsCount],
    ['Uptime', activity?.uptimeDays != null ? `${activity.uptimeDays} day(s)` : null],
  ].filter(([, value]) => value != null);

  return (
    <>
      {usage.length > 0 ? (
        <div className="po-panel">
          <span className="po-block-label">Apps seen in the last 7 days</span>
          <div className="po-usage-list">
            {usage.map(({ app, lastUsed }) => (
              <div key={app} className="po-usage-row">
                <span className="po-usage-app">{app}</span>
                <div className="po-usage-track">
                  <div
                    className="po-usage-fill"
                    style={{ width: `${(recencyFraction(lastUsed) * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="po-usage-when">{relative(lastUsed)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {stats.length > 0 ? (
        <div className="po-stat-row">
          {stats.map(([label, value]) => (
            <div key={label} className="po-stat">
              <span className="po-stat-value">{value}</span>
              <span className="po-stat-label">{label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {lastActivity ? (
        <p className="po-secondary po-foot-note">Last analysis: {lastActivity}</p>
      ) : null}
    </>
  );
}
