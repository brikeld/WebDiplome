const CATEGORY_COLORS = {
  video:       '#FF4E00',
  design:      '#2323FF',
  development: '#0FA020',
  '3d':        '#888888',
  browser:     '#cccac7',
};

export default function TechStack({ techStack }) {
  return (
    <div className="po-card po-tech">
      <p className="po-card-title">Tech Stack</p>

      <div className="po-app-grid">
        {techStack.primary_apps.map(app => (
          <div key={app.name} className="po-app-item">
            <span
              className="po-app-dot"
              style={{ background: CATEGORY_COLORS[app.category] ?? '#888' }}
            />
            <div className="po-app-text">
              <span className="po-app-name">{app.name}</span>
              <span className="po-app-category">{app.category}</span>
            </div>
          </div>
        ))}
      </div>

      <hr className="po-divider" />

      <p className="po-secondary" style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        AI Dependency Detected
      </p>
      <div className="po-ai-row">
        {techStack.ai_tools.map(tool => (
          <span key={tool} className="po-pill po-pill--accent">{tool}</span>
        ))}
      </div>

      <hr className="po-divider" />

      <p className="po-secondary" style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
        Languages detected
      </p>
      <div className="po-badge-row" style={{ marginTop: 0 }}>
        {techStack.languages_detected.map(lang => (
          <code key={lang} className="po-code-tag">{lang}</code>
        ))}
      </div>

      <hr className="po-divider" />

      <div className="po-badge-row" style={{ marginTop: 0 }}>
        <span className="po-pill">{techStack.design_tools_count} Design Tools</span>
        <span className="po-pill">{techStack.total_apps_installed} Apps Total</span>
        <span className="po-pill">{techStack.ai_tools.length} AI Assistants</span>
      </div>
    </div>
  );
}
