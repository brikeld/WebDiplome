import { getProfileTabs } from '@/features/profile/profileTabs.js';

export default function TabBar({
  activeTab,
  onTabChange,
  personaColor,
  className = '',
  variant = 'inline',
}) {
  const tabs = getProfileTabs();

  const rowClass =
    variant === 'rail'
      ? `tabs-row tabs-row--rail ${className}`.trim()
      : `tabs-row ${className}`.trim();

  return (
    <div
      className={rowClass}
      role="tablist"
      aria-label="Profile sections"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          className={`tab${activeTab === t.id ? ' active' : ''}${variant === 'rail' ? ' tab--rail' : ''}`}
          onClick={() => onTabChange(t.id)}
          style={
            variant === 'rail'
              ? undefined
              : activeTab === t.id
                ? { background: '#000', color: personaColor }
                : undefined
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
