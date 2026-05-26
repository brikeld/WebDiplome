import ScrollArea from '@/layout/ScrollArea.jsx';
import ProfileHeader from '@/features/profile/ProfileHeader.jsx';
import TabBar from '@/features/profile/TabBar.jsx';
import ProfileTab from '@/features/profile/ProfileTab.jsx';
import PostsTab from '@/features/feed/PostsTab.jsx';
import LeaderboardsTab from '@/features/profile/tabs/LeaderboardsTab.jsx';
import { machineHandleFromProfile } from '@/lib/profileUtils.js';
import { profilePaneLabel } from '@/features/profile/profileTabs.js';

export default function ProfileView({
  profile,
  personaColor,
  activeTab,
  onTabChange,
  mainScoreEntryReplayKey,
  isGeneratingPosts,
  personaBadgePersona = null,
  generateApiOrigin,
}) {
  const handleLabel = machineHandleFromProfile(profile);

  return (
    <>
      <div className="main-col">
        <ScrollArea key="profile-content" mode="profile">
          <div className="home-tab">
            <p className="home-top-label">{profilePaneLabel(activeTab)}</p>
            <div
              className="posts-capsule profile-content-capsule"
              style={{ '--persona-accent': personaColor }}
              role="tabpanel"
              aria-label={profilePaneLabel(activeTab)}
            >
              {activeTab === 'profile' && <ProfileTab />}
              {activeTab === 'posts' && (
                <PostsTab
                  profile={profile}
                  feedContext="profile"
                  hideInteractions
                  isGeneratingPosts={isGeneratingPosts}
                  personaBadgePersona={personaBadgePersona}
                />
              )}
              {activeTab === 'leaderboards' && (
                <LeaderboardsTab
                  profile={profile}
                  generateApiOrigin={generateApiOrigin}
                />
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      <aside className="persona-side-panel" aria-label="Profile">
        <p className="dashboard-top-label">{handleLabel}</p>
        <div
          className="dashboard-capsule profile-rail-capsule"
          style={{ '--persona-accent': personaColor }}
        >
          <ProfileHeader
            profile={profile}
            personaColor={personaColor}
            personaBadgePersona={personaBadgePersona}
            mainScoreEntryReplayKey={mainScoreEntryReplayKey}
            onNavigateTab={onTabChange}
          />
          <TabBar
            variant="rail"
            activeTab={activeTab}
            onTabChange={onTabChange}
            personaColor={personaColor}
          />
        </div>
      </aside>
    </>
  );
}
