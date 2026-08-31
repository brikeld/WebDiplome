import { isHostedApiOrigin } from '@/lib/aiJobClient.js';

/** Tab ids are stable; labels differ in local demo vs hosted production. */
const PROFILE_TAB_DEFS = [
  { id: 'posts', label: 'Posts', paneLabel: 'posts' },
  {
    id: 'profile',
    label: 'Profile',
    paneLabel: 'profile',
    localLabel: 'Data',
    localPaneLabel: 'data',
  },
  { id: 'leaderboards', label: 'Leaderboards', paneLabel: 'leaderboards' },
];

function resolveLocal(local) {
  if (local !== undefined) return local;
  return !isHostedApiOrigin();
}

/** Profile rail tabs (TabBar + left pane title). Local demo uses "Data" for the profile tab. */
export function getProfileTabs({ local } = {}) {
  const isLocal = resolveLocal(local);
  return PROFILE_TAB_DEFS.map((tab) => ({
    id: tab.id,
    label: isLocal && tab.localLabel ? tab.localLabel : tab.label,
    paneLabel: isLocal && tab.localPaneLabel ? tab.localPaneLabel : tab.paneLabel,
  }));
}

export function profilePaneLabel(tabId, { local } = {}) {
  return getProfileTabs({ local }).find((t) => t.id === tabId)?.paneLabel ?? 'posts';
}

/** Hosted-production tab list (tests / static imports). */
export const PROFILE_TABS = getProfileTabs({ local: false });
