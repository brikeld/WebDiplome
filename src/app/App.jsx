import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/layout/Sidebar.jsx';
import ProfileHeader from '@/features/profile/ProfileHeader.jsx';
import TabBar from '@/features/profile/TabBar.jsx';
import ProfileTab from '@/features/profile/ProfileTab.jsx';
import PostsTab from '@/features/feed/PostsTab.jsx';
import HomeTab from '@/features/home/HomeTab.jsx';
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
  /** 'home' = feed only; 'profile' = profile capsule + tab bar + sections */
  const [mainView, setMainView] = useState('home');
  const [activeTab, setActiveTab] = useState('posts');
  const [profile, setProfile] = useState(null);
  const [personaOverride, setPersonaOverride] = useState(null); // 'productivity' | 'popularity' | 'security' | null

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

  const personaToggleLabel =
    personaKey === 'productivity' ? 'P' : personaKey === 'security' ? 'S' : '☺';

  const cyclePersona = () => {
    // productivity → social(popularity) → security → productivity
    const order = ['productivity', 'popularity', 'security'];
    const idx = Math.max(0, order.indexOf(personaKey));
    const next = order[(idx + 1) % order.length];
    setPersonaOverride(next);
  };

  return (
    <div
      className={`page-outer persona-${personaKey}`}
      style={{ '--persona-accent': personaColor }}
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
      <Sidebar mainView={mainView} onSelectView={setMainView} />
      <div className="page">
        <div className="main-col">
          {mainView === 'home' && <HomeTab profile={profile} />}
          {mainView === 'profile' && (
            <>
              <ProfileHeader
                profile={profile}
                personaKey={personaKey}
                personaColor={personaColor}
                showTopHandle
              />

              <TabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                className="tabs-row--above-capsule"
              />

              <div
                className="profile-content-capsule"
                style={{ '--profile-accent': personaColor }}
              >
                <div className="tab-content">
                  {activeTab === 'profile' && <ProfileTab />}
                  {activeTab === 'posts' && <PostsTab profile={profile} />}
                  {activeTab === 'badges' && <BadgesTab />}
                  {activeTab === 'leaderboards' && <LeaderboardsTab />}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
