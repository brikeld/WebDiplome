/** Shared profile section ids + labels (TabBar + left pane title). */
export const PROFILE_TABS = [
  { id: 'posts', label: 'Posts', paneLabel: 'posts' },
  { id: 'profile', label: 'Profile', paneLabel: 'profile' },
  { id: 'leaderboards', label: 'Leaderboards', paneLabel: 'leaderboards' },
];

export function profilePaneLabel(tabId) {
  return PROFILE_TABS.find((t) => t.id === tabId)?.paneLabel ?? 'posts';
}
