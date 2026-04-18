import { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ProfileHeader from './components/ProfileHeader.jsx';
import TabBar from './components/TabBar.jsx';
import ProfileTab from './components/ProfileTab.jsx';
import PostsTab from './components/PostsTab.jsx';
import HomeTab from './components/HomeTab.jsx';
import BadgesTab from './components/BadgesTab.jsx';
import LeaderboardsTab from './components/LeaderboardsTab.jsx';
import { getGlobalScore } from './lib/profileUtils.js';

const PERSONA_KEYS = ['productivity', 'security', 'popularity'];
const PERSONA_ALIASES = {
  productivite: 'productivity',
  securite: 'security',
  popularite: 'popularity',
};
const PERSONA_COLORS = {
  productivity: '#2323FF',
  security: '#FF4E00',
  popularity: '#CEFE46',
};

function topPersonaFromProfile(profile) {
  if (!profile) return 'productivity';
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
  const score = getGlobalScore(profile) ?? 0;
  const w1 = Math.round(score * 0.95);
  const w2 = Math.round(score * 0.88);
  const w3 = Math.round(score * 0.8);
  const weights = { productivity: w1, security: w2, popularity: w3 };
  return Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0];
}

export default function App() {
  /** 'home' = feed only; 'profile' = profile capsule + tab bar + sections */
  const [mainView, setMainView] = useState('home');
  const [activeTab, setActiveTab] = useState('posts');
  const [profile, setProfile] = useState(null);

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
            setProfile(null);
            return;
          }
          setProfile(data[0]);
        })
        .catch(() => {
          if (!cancelled) setProfile(null);
        });
    };

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const personaKey = useMemo(() => topPersonaFromProfile(profile), [profile]);
  const personaColor = PERSONA_COLORS[personaKey] ?? PERSONA_COLORS.productivity;

  return (
    <div
      className={`page-outer persona-${personaKey}`}
      style={{ '--persona-bg': personaColor }}
    >
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
              />
              <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
              <div className="tab-content">
                {activeTab === 'profile' && <ProfileTab />}
                {activeTab === 'posts' && <PostsTab profile={profile} />}
                {activeTab === 'badges' && <BadgesTab />}
                {activeTab === 'leaderboards' && <LeaderboardsTab />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
