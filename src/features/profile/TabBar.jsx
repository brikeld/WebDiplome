import { PROFILE_TABS } from '@/features/profile/profileTabs.js';

export default function TabBar({
  activeTab,
  onTabChange,
  personaColor,
  className = '',
  variant = 'inline',
}) {
  const tabs = PROFILE_TABS;

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
          className={`tab${activeTab === t.id ? ' active' : ''}`}
          onClick={() => onTabChange(t.id)}
          style={
            variant === 'rail'
              ? undefined
              : activeTab === t.id
                ? { background: personaColor }
                : undefined
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
