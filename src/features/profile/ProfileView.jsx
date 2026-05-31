import ScrollArea from '@/layout/ScrollArea.jsx';
import ProfileHeader from '@/features/profile/ProfileHeader.jsx';
import TabBar from '@/features/profile/TabBar.jsx';
import ProfileTab from '@/features/profile/ProfileTab.jsx';
import PostsTab from '@/features/feed/PostsTab.jsx';
import LeaderboardsTab from '@/features/profile/tabs/LeaderboardsTab.jsx';
import { machineHandleFromProfile } from '@/lib/profileUtils.js';
import { profilePaneLabel } from '@/features/profile/profileTabs.js';
import { useProfileTabTransition } from '@/features/profile/useProfileTabTransition.js';

export default function ProfileView({
  profile,
  personaColor,
  activeTab,
  onTabChange,
  onOpenProfile,
  mainScoreEntryReplayKey,
  isGeneratingPosts,
  personaBadgePersona = null,
  generateApiOrigin,
}) {
  const handleLabel = machineHandleFromProfile(profile);
  const { displayTab, phase } = useProfileTabTransition(activeTab);
  const paneLabel = profilePaneLabel(displayTab);

  return (
    <>
      <div className="main-col">
        <ScrollArea key="profile-content" mode="profile">
          <div className="home-tab">
            <p
              className={`home-top-label profile-pane-label profile-pane-label--${phase}`}
              key={displayTab}
            >
              {paneLabel}
            </p>
            <div
              className={`posts-capsule profile-content-capsule profile-content-capsule--${phase}`}
              style={{ '--persona-accent': personaColor }}
              role="tabpanel"
              aria-label={paneLabel}
              aria-busy={phase !== 'visible'}
            >
              <div className="profile-tab-panels">
                <div className="profile-tab-panels__inner" data-profile-tab={displayTab}>
                  {displayTab === 'profile' && <ProfileTab profile={profile} />}
                  {displayTab === 'posts' && (
                    <PostsTab
                      profile={profile}
                      feedContext="profile"
                      hideInteractions
                      isGeneratingPosts={isGeneratingPosts}
                      personaBadgePersona={personaBadgePersona}
                      onOpenProfile={onOpenProfile}
                    />
                  )}
                  {displayTab === 'leaderboards' && (
                    <LeaderboardsTab profile={profile} />
                  )}
                </div>
              </div>
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
            onOpenProfile={onOpenProfile}
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
