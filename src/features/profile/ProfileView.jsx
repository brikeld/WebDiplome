import ScrollArea from '@/layout/ScrollArea.jsx';
import ProfileHeader from '@/features/profile/ProfileHeader.jsx';
import TabBar from '@/features/profile/TabBar.jsx';
import ProfileRailPersonaScores from '@/features/profile/ProfileRailPersonaScores.jsx';
import ProfileTab from '@/features/profile/ProfileTab.jsx';
import PostsTab from '@/features/feed/PostsTab.jsx';
import LeaderboardsTab from '@/features/profile/tabs/LeaderboardsTab.jsx';
import { machineHandleFromProfile, resolveDominantPersonaKey } from '@/lib/profileUtils.js';

const PERSONA_COLORS = {
  productivity: '#D8D8D8',
  security: '#759AEF',
  popularity: '#CCF847',
};
import { profilePaneLabel } from '@/features/profile/profileTabs.js';
import { useProfileTabTransition } from '@/features/profile/useProfileTabTransition.js';
import { useProfileIdentityTransition } from '@/features/profile/useProfileIdentityTransition.js';

export default function ProfileView({
  profile,
  personaColor,
  activeTab,
  onTabChange,
  onOpenProfile,
  deletedProfileIds = [],
  mainScoreEntryReplayKey,
  isGeneratingPosts,
  personaBadgePersona = null,
  generateApiOrigin,
}) {
  const { displayProfile, phase: identityPhase } = useProfileIdentityTransition(profile);
  const resolvedProfile = displayProfile ?? profile;
  const storedPersonaKey = resolveDominantPersonaKey(resolvedProfile);
  const themePersonaKey = personaBadgePersona ?? storedPersonaKey;
  const themePersonaColor =
    personaColor ?? PERSONA_COLORS[themePersonaKey] ?? PERSONA_COLORS.productivity;
  const handleLabel = machineHandleFromProfile(resolvedProfile);
  const { displayTab, phase: tabPhase } = useProfileTabTransition(activeTab);
  const paneLabel = profilePaneLabel(displayTab);

  return (
    <div className={`profile-view-body profile-view-body--${identityPhase}`}>
      <div className="main-col">
        <ScrollArea key="profile-content" mode="profile">
          <div className="home-tab">
            <p
              className={`home-top-label profile-pane-label profile-pane-label--${tabPhase}`}
              key={displayTab}
            >
              {paneLabel}
            </p>
            <div
              className={`posts-capsule profile-content-capsule profile-content-capsule--${tabPhase}`}
              style={{ '--persona-accent': themePersonaColor }}
              role="tabpanel"
              aria-label={paneLabel}
              aria-busy={tabPhase !== 'visible'}
            >
              <div className="profile-tab-panels">
                <div className="profile-tab-panels__inner" data-profile-tab={displayTab}>
                  {displayTab === 'profile' && <ProfileTab profile={resolvedProfile} />}
                  {displayTab === 'posts' && (
                    <PostsTab
                      profile={resolvedProfile}
                      feedContext="profile"
                      hideInteractions
                      isGeneratingPosts={isGeneratingPosts}
                      personaBadgePersona={themePersonaKey}
                      onOpenProfile={onOpenProfile}
                      deletedProfileIds={deletedProfileIds}
                    />
                  )}
                  {displayTab === 'leaderboards' && (
                    <LeaderboardsTab profile={resolvedProfile} />
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
          style={{ '--persona-accent': themePersonaColor }}
        >
          <ProfileHeader
            profile={resolvedProfile}
            personaColor={themePersonaColor}
            personaBadgePersona={themePersonaKey}
            mainScoreEntryReplayKey={mainScoreEntryReplayKey}
            onNavigateTab={onTabChange}
            onOpenProfile={onOpenProfile}
            variant="rail"
          />
          <ProfileRailPersonaScores profile={resolvedProfile} />
          <TabBar
            variant="rail"
            activeTab={activeTab}
            onTabChange={onTabChange}
            personaColor={themePersonaColor}
          />
        </div>
      </aside>
    </div>
  );
}
