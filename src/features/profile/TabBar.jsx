export default function TabBar({ activeTab, onTabChange, className = '' }) {
  const tabs = [
    { id: 'posts', label: 'Posts' },
    { id: 'badges', label: 'Badges' },
    { id: 'profile', label: 'Profile' },
    { id: 'leaderboards', label: 'Rankings' },
  ];

  return (
    <div
      className={`tabs-row ${className}`.trim()}
      role="tablist"
      aria-label="Profile sections"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          className={`tab${activeTab === t.id ? ' active' : ''}`}
          onClick={() => onTabChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
