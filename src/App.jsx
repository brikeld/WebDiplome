import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ProfileHeader from './components/ProfileHeader.jsx';
import TabBar from './components/TabBar.jsx';
import ProfileTab from './components/ProfileTab.jsx';
import PostsTab from './components/PostsTab.jsx';
import BadgesTab from './components/BadgesTab.jsx';
import LeaderboardsTab from './components/LeaderboardsTab.jsx';
import { getGlobalScore } from './lib/profileUtils.js';

export default function App() {
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

  const globalScore = profile ? getGlobalScore(profile) : null;
  const usersAbove =
    profile?.usersAbove ?? profile?.users_above ?? profile?.rankDelta;
  const scoreSubtext =
    usersAbove != null && usersAbove !== ''
      ? `${usersAbove} users above you`
      : null;

  return (
    <div className="page-outer">
      <div className="page">
        <Sidebar globalScore={globalScore} scoreSubtext={scoreSubtext} />
        <div className="main-col">
          <ProfileHeader profile={profile} activeTab={activeTab} />
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="tab-content">
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'posts' && <PostsTab profile={profile} />}
            {activeTab === 'badges' && <BadgesTab />}
            {activeTab === 'leaderboards' && <LeaderboardsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
