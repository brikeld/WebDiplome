export default function TabBar({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'posts', label: 'Posts' },
    { id: 'badges', label: 'Badges' },
    { id: 'profile', label: 'Profile' },
    { id: 'leaderboards', label: 'Leaderboards' },
  ];

  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={activeTab === t.id ? 'active' : ''}
          onClick={() => onTabChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

