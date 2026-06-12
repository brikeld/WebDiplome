import PersonaPill from './PersonaPill.jsx';
import { personaColorAtIndex } from '@/lib/personaColors.js';

function ExtensionBars({ extensions }) {
  const max = Math.max(...extensions.map((e) => e.count), 1);
  return (
    <div className="po-ext-list">
      {extensions.map(({ ext, count }) => (
        <div key={ext} className="po-ext-row">
          <code className="po-ext-name">.{ext}</code>
          <div className="po-ext-track">
            <div className="po-ext-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="po-ext-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function TechStack({ techStack }) {
  const apps = techStack?.primaryApps ?? [];
  const dock = techStack?.dockApps ?? [];
  const extensions = techStack?.fileExtensions ?? [];

  return (
    <>
      {apps.length > 0 ? (
        <div className="po-panel">
          <span className="po-block-label">Most used apps</span>
          <div className="po-app-grid">
            {apps.map((app, i) => (
              <div key={app.name} className="po-app-item">
                <span className="po-app-dot" style={{ background: personaColorAtIndex(i) }} />
                <div className="po-app-text">
                  <span className="po-app-name">{app.name}</span>
                  <span className="po-app-category">{app.category}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {techStack?.installedCount != null ? (
        <p className="po-summary-line">
          <strong>{techStack.installedCount}</strong> applications installed
        </p>
      ) : null}

      {dock.length > 0 ? (
        <div className="po-block">
          <span className="po-block-label">Pinned in the Dock</span>
          <div className="po-chip-row">
            {dock.map((app) => (
              <PersonaPill key={app}>{app}</PersonaPill>
            ))}
          </div>
        </div>
      ) : null}

      {extensions.length > 0 ? (
        <div className="po-block">
          <span className="po-block-label">File types created recently</span>
          <div className="po-panel">
            <ExtensionBars extensions={extensions} />
          </div>
        </div>
      ) : null}
    </>
  );
}
