import { PoFold } from './PoCard.jsx';
import PersonaPill from './PersonaPill.jsx';
import { personaColorAtIndex } from '@/lib/personaColors.js';

function AppList({ apps, offset = 0 }) {
  return (
    <div className="po-app-grid">
      {apps.map((app, i) => (
        <div key={app.name} className="po-app-item">
          <span className="po-app-dot" style={{ background: personaColorAtIndex(offset + i) }} />
          <div className="po-app-text">
            <span className="po-app-name">{app.name}</span>
            <span className="po-app-category">{app.category}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TechStack({ techStack, dominantPersona = 'productivity', expanded = false }) {
  const apps = techStack.primary_apps ?? [];
  const top = apps.slice(0, 4);
  const rest = apps.slice(4);

  return (
    <>
      <div className="po-panel">
        <AppList apps={top} />
      </div>

      <p className="po-summary-line">
        <strong>{techStack.total_apps_installed}</strong> apps · {techStack.ai_tools.length} AI assistants
      </p>

      <PoFold open={expanded}>
        {rest.length ? (
          <div className="po-block">
            <span className="po-block-label">More apps</span>
            <div className="po-panel">
              <AppList apps={rest} offset={top.length} />
            </div>
          </div>
        ) : null}

        <div className="po-block">
          <span className="po-block-label">AI dependency</span>
          <div className="po-chip-row">
            {techStack.ai_tools.map((tool) => (
              <PersonaPill key={tool} dot personaKey={dominantPersona}>
                {tool}
              </PersonaPill>
            ))}
          </div>
        </div>

        <div className="po-block">
          <span className="po-block-label">Languages detected</span>
          <div className="po-chip-row">
            {techStack.languages_detected.map((lang) => (
              <code key={lang} className="po-code-tag">
                {lang}
              </code>
            ))}
          </div>
        </div>
      </PoFold>
    </>
  );
}
