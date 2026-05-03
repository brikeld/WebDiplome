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
  productivity: '#2323FF',
  security: '#FF4E00',
  popularity: '#0FA020',
};

/** Tab strip background (Posts / Badges / Profile / Rankings) per persona */
const PERSONA_TAB_FILLS = {
  productivity: '#D9D9FD',
  security: '#FFE3D7',
  popularity: '#E1FFE4',
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

  const totalMinutes = Math.floor(diffMs / 60_000);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  if (days >= 1) {
    // "2d & 6 hours ago"
    return `${days}d & ${plural(hours, 'hour')} ago`;
  }

  if (totalHours >= 1) {
    // "3h & 40 minutes ago"
    return `${totalHours}h & ${plural(minutes, 'minute')} ago`;
  }

  return `${plural(totalMinutes, 'minute')} ago`;
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

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch('http://localhost:3001/api/profiles')
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
  const lastAnalysisText = formatLastAnalysis(profile);

  const personaToggleLabel =
    personaKey === 'productivity' ? 'P' : personaKey === 'security' ? 'S' : '☺';

  const cyclePersona = () => {
    // productivity → social(popularity) → security → productivity
    const order = ['productivity', 'popularity', 'security'];
    const idx = Math.max(0, order.indexOf(personaKey));
    const next = order[(idx + 1) % order.length];
    setPersonaOverride(next);
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
      <button
        type="button"
        className="persona-toggle-btn"
        aria-label="Change persona theme"
        onClick={cyclePersona}
        style={{
          borderColor: '#000',
          color: '#fff',
          background: personaColor,
        }}
      >
        {personaToggleLabel}
      </button>
      <div className="project-name">projectName</div>
      <Sidebar mainView={mainView} onSelectView={setMainView} />
      <div className="page">
        <div className="main-col">
          <ScrollArea key={mainView} mode={mainView}>
            {mainView === 'home' && <HomeTab profile={profile} />}
            {mainView === 'profile' && (
              <>
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

                {lastAnalysisText ? (
                  <div className="profile-last-analysis" aria-label="Last analysis">
                    <span
                      className="profile-last-analysis-pill"
                      style={{ background: personaColor, color: '#fff' }}
                    >
                      Last analysis:&nbsp;{lastAnalysisText}
                    </span>
                  </div>
                ) : null}

                <div
                  className="profile-content-capsule"
                  style={{ '--profile-accent': personaColor }}
                >
                  <div className="tab-content">
                    {activeTab === 'profile' && <ProfileTab />}
                    {activeTab === 'posts' && <PostsTab profile={profile} feedContext="profile" />}
                    {activeTab === 'badges' && <BadgesTab />}
                    {activeTab === 'leaderboards' && <LeaderboardsTab />}
                  </div>
                </div>
              </>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
