import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ProfileHeader from './components/ProfileHeader.jsx';
import TabBar from './components/TabBar.jsx';
import ProfileTab from './components/ProfileTab.jsx';
import PostsTab from './components/PostsTab.jsx';
import BadgesTab from './components/BadgesTab.jsx';
import LeaderboardsTab from './components/LeaderboardsTab.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('posts');

  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <div className="main">
          <ProfileHeader />
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="tab-content">
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'posts' && <PostsTab />}
            {activeTab === 'badges' && <BadgesTab />}
            {activeTab === 'leaderboards' && <LeaderboardsTab />}
          </div>
        </div>
      </div>
    </>
  );
}

