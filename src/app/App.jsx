import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/layout/Sidebar.jsx';
import ScrollArea from '@/layout/ScrollArea.jsx';
import ProfileHeader from '@/features/profile/ProfileHeader.jsx';
import TabBar from '@/features/profile/TabBar.jsx';
import ProfileTab from '@/features/profile/ProfileTab.jsx';
import PostsTab from '@/features/feed/PostsTab.jsx';
import HomeTab from '@/features/home/HomeTab.jsx';
import LandingPage from '@/landing-page/LandingPage.jsx';
import BadgesTab from '@/features/profile/tabs/BadgesTab.jsx';
import LeaderboardsTab from '@/features/profile/tabs/LeaderboardsTab.jsx';
import { getGlobalScore } from '@/lib/profileUtils.js';

const API_ORIGIN =
  (import.meta?.env?.VITE_API_ORIGIN && String(import.meta.env.VITE_API_ORIGIN)) ||
  'http://localhost:3001';

const GENERATE_API_ORIGIN =
  (import.meta?.env?.VITE_GENERATE_API_ORIGIN && String(import.meta.env.VITE_GENERATE_API_ORIGIN)) ||
  API_ORIGIN;

const PERSONA_KEYS = ['productivity', 'security', 'popularity'];
const PERSONA_ALIASES = {
  productivity: 'productivity',
  security: 'security',
  popularity: 'popularity',
  social: 'popularity',
  productivite: 'productivity',
  securite: 'security',
  popularite: 'popularity',
};
const PERSONA_COLORS = {
  productivity: '#D8D8D8',
  security: '#759AEF',
  popularity: '#CCF847',
};
const PERSONA_LABELS = {
  productivity: 'Productivity',
  security: 'Security',
  popularity: 'Social',
};

/** Page background — always black */
const PERSONA_TAB_FILLS = {
  productivity: '#000000',
  security: '#000000',
  popularity: '#000000',
};

function formatLastAnalysis(profile) {
  if (!profile) return null;
  const raw =
    profile?.lastAnalysis ??
    profile?.last_analysis ??
    profile?.lastAnalysisAt ??
    profile?.last_analysis_at ??
    profile?.analysisAt ??
    profile?.analysis_at ??
    profile?.updatedAt ??
    profile?.updated_at ??
    null;

  if (!raw) return null;

  const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === 'string') {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const d = toDate(raw);
  if (!d) {
    // If backend already provides "3h ago"-style strings, keep them.
    return typeof raw === 'string' ? raw : String(raw);
  }

  const diffMs = Date.now() - d.getTime();
  if (diffMs <= 0) return 'just now';

  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(diffMs / 60_000);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  const seconds = totalSeconds % 60;

  // Compact, always includes seconds.
  if (days >= 1) return `${days}d ${hours}h ${minutes}m ${seconds}s ago`;
  if (totalHours >= 1) return `${totalHours}h ${minutes}m ${seconds}s ago`;
  if (totalMinutes >= 1) return `${totalMinutes}m ${seconds}s ago`;
  return `${Math.max(1, totalSeconds)}s ago`;
}

function topPersonaFromProfile(profile) {
  if (!profile) return 'productivity';

  const rawDominant = String(
    profile?.dominantPersona ?? profile?.dominant_persona ?? ''
  ).toLowerCase();
  if (rawDominant) {
    const key =
      PERSONA_ALIASES[rawDominant] ??
      (PERSONA_KEYS.includes(rawDominant) ? rawDominant : null);
    if (key) return key;
  }

  const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
  if (posts.length > 0) {
    const counts = Object.fromEntries(PERSONA_KEYS.map((k) => [k, 0]));
    for (const p of posts) {
      const raw = String(p?.persona ?? '').toLowerCase();
      const key = PERSONA_ALIASES[raw] ?? (PERSONA_KEYS.includes(raw) ? raw : null);
      if (key) counts[key] += 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] > 0) return sorted[0][0];
  }
  return 'productivity';
}

export default function App() {
  /** 'landing' = onboarding/intro; 'home' = feed only; 'profile' = profile capsule + tab bar + sections */
  const [mainView, setMainView] = useState('landing');
  const [activeTab, setActiveTab] = useState('posts');
  const [profile, setProfile] = useState(null);
  const [personaOverride, setPersonaOverride] = useState(null); // 'productivity' | 'popularity' | 'security' | null
  const [nowTick, setNowTick] = useState(0);
  const [postGen, setPostGen] = useState({ loading: false, error: null });

  // Lock body scroll in home mode; release it for profile (full-page scroll).
  useEffect(() => {
    const isHome = mainView === 'home';
    document.documentElement.style.overflowY = isHome ? 'hidden' : '';
    document.body.style.overflowY = isHome ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflowY = '';
      document.body.style.overflowY = '';
    };
  }, [mainView]);

  // Re-render once per second in profile mode so "Last analysis" stays live.
  useEffect(() => {
    if (mainView !== 'profile') return undefined;
    const id = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [mainView]);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch(`${API_ORIGIN}/api/profiles`)
        .then((res) => {
          if (!res.ok) throw new Error('failed');
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          if (!Array.isArray(data) || data.length === 0) {
            return; /* keep previous profile; avoid clearing on transient [] */
          }
          setProfile(data[0]);
        })
        .catch(() => {
          if (cancelled) return; /* keep previous profile on network error */
        });
    };

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const calculatedPersonaKey = useMemo(() => topPersonaFromProfile(profile), [profile]);
  const personaKey = personaOverride ?? calculatedPersonaKey;
  const personaColor = PERSONA_COLORS[personaKey] ?? PERSONA_COLORS.productivity;
  const personaTabFill =
    PERSONA_TAB_FILLS[personaKey] ?? PERSONA_TAB_FILLS.productivity;
  const lastAnalysisText = useMemo(() => formatLastAnalysis(profile), [profile, nowTick]);
  const globalScore = getGlobalScore(profile ?? {}) ?? 76;
  const personaToggleLabel =
    personaKey === 'productivity' ? 'P' : personaKey === 'security' ? 'S' : '☺';

  const cyclePersona = () => {
    // productivity → social(popularity) → security → productivity
    const order = ['productivity', 'popularity', 'security'];
    const idx = Math.max(0, order.indexOf(personaKey));
    const next = order[(idx + 1) % order.length];
    setPersonaOverride(next);
  };

  const handleGeneratePersonaPosts = async () => {
    if (postGen.loading || !profile) return;
    setPostGen({ loading: true, error: null });
    try {
      const res = await fetch(`${GENERATE_API_ORIGIN}/api/posts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const newPosts = Array.isArray(data.posts) ? data.posts : [];
      setProfile((prev) => {
        if (!prev) return prev;
        const existing = Array.isArray(prev.personaPosts) ? prev.personaPosts : [];
        return { ...prev, personaPosts: [...newPosts, ...existing] };
      });
      setPostGen({ loading: false, error: null });
    } catch (e) {
      setPostGen({ loading: false, error: e?.message || 'Generation failed' });
    }
  };

  if (mainView === 'landing') {
    return <LandingPage onEnterDemo={() => setMainView('home')} />;
  }

  return (
    <div
      className={`page-outer persona-${personaKey} view-${mainView}`}
      style={{
        '--persona-accent': personaColor,
        '--tabs-capsule-fill': personaTabFill,
        '--persona-secondary': personaTabFill,
      }}
    >
      {mainView !== 'home' && (
        <button
          type="button"
          className="persona-toggle-btn persona-toggle-btn--compact"
          aria-label="Change persona theme"
          onClick={cyclePersona}
          style={{
            borderColor: personaColor,
            backgroundColor: personaColor,
            color: '#000',
          }}
        >
          {personaToggleLabel}
        </button>
      )}
      <div className="project-name">COMPLIANT</div>
      <Sidebar mainView={mainView} onSelectView={setMainView} />
      <div className="page">
        <div className="main-col">
          <ScrollArea key={mainView} mode={mainView}>
            {mainView === 'home' && <HomeTab profile={profile} />}
            {mainView === 'profile' && (
              <div className="profile-capsule-wrap">
                <div
                  className="posts-capsule"
                  style={{ '--persona-accent': personaColor }}
                >
                  <div className="posts-capsule-inner">
                    <ProfileHeader
                      profile={profile}
                      personaKey={personaKey}
                      personaColor={personaColor}
                    />

                    <TabBar
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      personaColor={personaColor}
                    />

                    <div className="profile-tabs-divider" aria-hidden />

                    <div className="tab-content">
                      {activeTab === 'profile' && <ProfileTab />}
                      {activeTab === 'posts' && <PostsTab profile={profile} feedContext="profile" />}
                      {activeTab === 'badges' && <BadgesTab />}
                      {activeTab === 'leaderboards' && <LeaderboardsTab />}
                    </div>
                  </div>
                </div>

                <div className="profile-side-rings" aria-label="Persona progress">
                  {PERSONA_KEYS.filter((k) => k !== personaKey).map((k) => {
                    const otherColor = PERSONA_COLORS[k];
                    const offset = k === 'productivity' ? 8 : k === 'security' ? 14 : 11;
                    const value = Math.max(0, Math.min(100, globalScore - offset));
                    const R = 32;
                    const CIRC = 2 * Math.PI * R;
                    const dash = CIRC * (value / 100);
                    const gap = CIRC - dash;
                    return (
                      <div key={k} className="persona-side-other" style={{ '--persona-other-accent': otherColor }}>
                        <svg className="persona-side-other-ring" viewBox="0 0 80 80" aria-label={`${PERSONA_LABELS[k]} ${value}%`}>
                          <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="8" />
                          <circle
                            cx="40"
                            cy="40"
                            r={R}
                            fill="none"
                            stroke="#000"
                            strokeWidth="8"
                            strokeDasharray={`${dash} ${gap}`}
                            strokeLinecap="round"
                            style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }}
                          />
                        </svg>
                        <span className="persona-side-other-label">{PERSONA_LABELS[k].toLowerCase()}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="profile-persona-side-stack" aria-label="Persona + analysis">
                  <div className="profile-persona-side" aria-label="Persona">
                    <span
                      className="profile-persona-side-pill"
                      style={{ background: 'transparent', border: `4px solid ${personaColor}`, color: personaColor }}
                    >
                      {`${String(PERSONA_LABELS[personaKey] ?? '').toUpperCase()} USER`}
                    </span>
                  </div>
                  {lastAnalysisText ? (
                    <div className="profile-last-analysis" aria-label="Last analysis">
                      <span
                        className="profile-last-analysis-pill"
                        style={{ background: personaColor, color: '#000' }}
                      >
                        Last analysis :<br />
                        <strong>{lastAnalysisText}</strong>
                      </span>
                    </div>
                  ) : null}
                  <div className="profile-create-content" aria-label="Create new content">
                    <button
                      type="button"
                      className="profile-last-analysis-pill"
                      style={{ background: personaColor, color: '#000' }}
                      disabled={postGen.loading || !profile}
                      onClick={handleGeneratePersonaPosts}
                    >
                      {postGen.loading ? 'Generating…' : 'Create new content'}
                    </button>
                    {postGen.error ? (
                      <span className="generate-posts-error" role="alert">
                        {postGen.error}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        {mainView === 'home' && (
          <aside className="persona-side-panel" aria-label="Persona summary">
            <div className="persona-side-top-group">
              <button
                type="button"
                className="persona-side-type"
                onClick={cyclePersona}
                style={{ backgroundColor: 'transparent', borderColor: personaColor, color: personaColor }}
              >
                <span className="persona-side-type-label">
                  {`${String(PERSONA_LABELS[personaKey] ?? '').toUpperCase()} USER`}
                </span>
              </button>
              <div className="persona-side-substack">
                {lastAnalysisText ? (
                  <div className="persona-side-last-analysis" aria-label="Last analysis">
                    <span
                      className="profile-last-analysis-pill"
                      style={{ background: personaColor, color: '#000' }}
                    >
                      Last analysis :<br />
                      <strong>{lastAnalysisText}</strong>
                    </span>
                  </div>
                ) : null}
                <div className="persona-side-create" aria-label="Create new content">
                  <button
                    type="button"
                    className="profile-last-analysis-pill"
                    style={{ background: personaColor, color: '#000' }}
                    disabled={postGen.loading || !profile}
                    onClick={handleGeneratePersonaPosts}
                  >
                    {postGen.loading ? 'Generating…' : 'Create new content'}
                  </button>
                  {postGen.error ? (
                    <span className="generate-posts-error" role="alert">
                      {postGen.error}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="persona-side-others">
              <div
                className="persona-side-score"
                aria-label={`Score ${globalScore}`}
                style={{ '--persona-other-accent': personaColor }}
              >
                <span className="persona-side-score-num">{globalScore}</span>
              </div>
              {PERSONA_KEYS.filter((k) => k !== personaKey).map((k) => {
                const otherColor = PERSONA_COLORS[k];
                const offset = k === 'productivity' ? 8 : k === 'security' ? 14 : 11;
                const value = Math.max(0, Math.min(100, globalScore - offset));
                const R = 32;
                const CIRC = 2 * Math.PI * R;
                const dash = CIRC * (value / 100);
                const gap = CIRC - dash;
                return (
                  <div key={k} className="persona-side-other" style={{ '--persona-other-accent': otherColor }}>
                    <svg className="persona-side-other-ring" viewBox="0 0 80 80" aria-label={`${PERSONA_LABELS[k]} ${value}%`}>
                      <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="8" />
                      <circle
                        cx="40"
                        cy="40"
                        r={R}
                        fill="none"
                        stroke="#000"
                        strokeWidth="8"
                        strokeDasharray={`${dash} ${gap}`}
                        strokeLinecap="round"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }}
                      />
                    </svg>
                    <span className="persona-side-other-label">{PERSONA_LABELS[k].toLowerCase()}</span>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
