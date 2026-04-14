import { useState, useEffect } from 'react';
import {
  activeSinceLabel,
  displayNameFromProfile,
  formatChipShort,
  formatRelativeTimeAgo,
  getGlobalScore,
  initialsFromProfile,
  mostUsedAppsLine,
  storagePercent,
  systemLanguagesCount,
} from '../lib/profileUtils.js';

function lastAnalysisRaw(p) {
  return (
    p?.lastAnalysisAt ??
    p?.last_analysis_at ??
    p?.lastAnalysis ??
    p?.last_analysis ??
    p?.collectedAt ??
    p?.collected_at
  );
}

function storageValClass(pct) {
  if (pct == null) return '';
  if (pct <= 25) return 'ok';
  if (pct <= 70) return 'warn';
  return 'bad';
}

export default function ProfileHeader({ profile, activeTab }) {
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTimeTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const name = displayNameFromProfile(profile ?? {});
  const initials = initialsFromProfile(profile ?? {});
  const handle = profile?.machineName ? `@${profile.machineName}` : '@—';
  const chip = formatChipShort(profile ?? {});
  const score = getGlobalScore(profile ?? {}) ?? 76;
  const lastRaw = profile ? lastAnalysisRaw(profile) : null;
  const lastAnalysisText = lastRaw ? formatRelativeTimeAgo(lastRaw) : '—';

  const connections = profile?.connections ?? profile?.connections_count ?? 14;
  const badgesCount = profile?.badgesCount ?? profile?.badges_count ?? 11;

  const pct = profile ? storagePercent(profile) : null;
  const storageClass = storageValClass(pct);

  const w1 = Math.min(100, Math.round(score * 0.95));
  const w2 = Math.min(100, Math.round(score * 0.88));
  const w3 = Math.min(100, Math.round(score * 0.8));

  return (
    <>
      <div className="profile-hero-card">
        <div className="profile-left">
          <div className="avatar-row">
            <div className="profile-avatar-lg" aria-hidden>
              {initials}
            </div>
            <div>
              <div className="profile-name-lg">{name}</div>
              <div className="profile-handle-lg">{handle}</div>
            </div>
          </div>

          <div className="badges-section">
            <div className="badges-label">Top Badges</div>
            <div className="top-badges">
              <div className="badge-square badge-prod">
                <span className="b-name">Productivity</span>
              </div>
              <div className="badge-square badge-sec">
                <span className="b-name">Security</span>
              </div>
              <div className="badge-square badge-pop">
                <span className="b-name">Popularity</span>
              </div>
            </div>
          </div>

          <div className="stats-row">
            <div>
              <div className="stat-val">{connections}</div>
              <div className="stat-key">Connections</div>
            </div>
            <div>
              <div className="stat-val">{badgesCount}</div>
              <div className="stat-key">Badges</div>
            </div>
          </div>
        </div>

        <div className="profile-right">
          <div>
            <div className="score-label-tiny">Digital Score</div>
            <div className="score-huge">{score}</div>
          </div>
          <div className="sub-scores">
            <div className="sub-row">
              <div className="sub-header">
                <span>Productivity</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${w1}%`, background: 'var(--prod)' }}
                />
              </div>
            </div>
            <div className="sub-row">
              <div className="sub-header">
                <span>Security</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${w2}%`, background: 'var(--sec)' }}
                />
              </div>
            </div>
            <div className="sub-row">
              <div className="sub-header">
                <span>Popularity</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${w3}%`, background: 'var(--pop)' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="last-analysis-bar">
        <div className="la-label">Last analysis</div>
        <div className="la-val">{lastAnalysisText}</div>
      </div>

      {activeTab === 'profile' ? (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-key">Active since</div>
              <div className="metric-val ok">{activeSinceLabel(profile ?? {})}</div>
            </div>
            <div className="metric-card">
              <div className="metric-key">Chip</div>
              <div className="metric-val">{chip}</div>
            </div>
            <div className="metric-card">
              <div className="metric-key">RAM</div>
              <div className="metric-val ok">{profile?.ram ?? '—'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-key">Battery cycles</div>
              <div className="metric-val ok">
                {profile?.batteryCycles ?? profile?.battery_cycles ?? '—'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-key">Storage used</div>
              <div
                className={`metric-val${storageClass ? ` ${storageClass}` : ''}`}
              >
                {pct != null ? `${pct}%` : '—'}
              </div>
            </div>
          </div>

          <div className="metrics-grid-2">
            <div className="metric-card">
              <div className="metric-key">Applications</div>
              <div className="metric-val">
                {profile?.applications ?? profile?.app_count ?? '—'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-key">Sys. languages</div>
              <div className="metric-val">{systemLanguagesCount(profile ?? {})}</div>
            </div>
            <div className="metric-card metric-card-span-2">
              <div className="metric-key">Most used apps</div>
              <div className="metric-val metric-val-apps">
                {mostUsedAppsLine(profile ?? {})}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-key">OS Version</div>
              <div className="metric-val">
                {profile?.osVersion ?? profile?.os_version ?? '—'}
              </div>
              {profile?.appearance || profile?.appearence || profile?.ui_theme ? (
                <div className="metric-sub">
                  {profile?.appearance ??
                    profile?.appearence ??
                    profile?.ui_theme}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
