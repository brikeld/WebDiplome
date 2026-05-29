import KeyValue from './KeyValue.jsx';
import { PERSONA_UI_COLORS, PERSONA_UI_LABELS } from '@/lib/personaColors.js';

const PERSONA_KEYS = ['productivity', 'security', 'popularity'];

function StatTile({ label, value, hint }) {
  return (
    <div className="po-footprint-stat">
      <span className="po-footprint-stat-value">{value}</span>
      <span className="po-footprint-stat-label">{label}</span>
      {hint ? <span className="po-footprint-stat-hint">{hint}</span> : null}
    </div>
  );
}

function PostBar({ personaKey, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="po-post-bar po-post-bar--wide">
      <div className="po-post-bar-head">
        <span className="po-post-bar-persona">
          <i className="po-score-dot" style={{ background: PERSONA_UI_COLORS[personaKey] }} />
          {PERSONA_UI_LABELS[personaKey] ?? personaKey}
        </span>
        <span className="po-post-bar-count">
          {count} <span className="po-post-bar-pct">({pct}%)</span>
        </span>
      </div>
      <div className="po-bar-track">
        <div
          className="po-bar-fill po-bar-fill--persona"
          data-persona={personaKey}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function PostFootprint({ postFootprint }) {
  const {
    total,
    byPersona,
    withAssets,
    systemPosts,
    generatedPosts,
    hiddenPosts = 0,
    totalRankings = 0,
    hiddenRankings = 0,
    visibleRankings = 0,
  } = postFootprint ?? {
    total: 0,
    byPersona: {},
    withAssets: 0,
    systemPosts: 0,
    generatedPosts: 0,
    hiddenPosts: 0,
    totalRankings: 0,
    hiddenRankings: 0,
    visibleRankings: 0,
  };

  if (!total) {
    return <p className="po-secondary">No persona posts synced yet.</p>;
  }

  const visiblePosts = Math.max(0, total - hiddenPosts);
  const withoutAssets = Math.max(0, total - withAssets);

  return (
    <div className="po-footprint">
      <div className="po-footprint-stats">
        <StatTile label="Total posts" value={total} hint="In your feed" />
        <StatTile label="AI generated" value={generatedPosts} hint="From LM Studio" />
        <StatTile label="System notices" value={systemPosts} hint="Compliance alerts" />
        <StatTile label="With attachments" value={withAssets} hint={`${withoutAssets} text-only`} />
      </div>

      <div className="po-footprint-columns">
        <div className="po-panel po-footprint-panel">
          <span className="po-block-label">Posts by persona</span>
          <p className="po-footprint-lead">How your feed splits across the three persona tracks.</p>
          <div className="po-footprint-bars">
            {PERSONA_KEYS.map((key) => (
              <PostBar key={key} personaKey={key} count={byPersona[key] ?? 0} total={total} />
            ))}
          </div>
        </div>

        <div className="po-panel po-footprint-panel">
          <span className="po-block-label">Visibility & rankings</span>
          <p className="po-footprint-lead">What you show in the feed and on leaderboards.</p>
          <div className="po-kv-grid po-kv-grid--compact">
            <KeyValue label="Visible posts" value={visiblePosts} />
            <KeyValue label="Hidden posts" value={hiddenPosts || 'None'} />
            <KeyValue
              label="Leaderboard slots"
              value={totalRankings ? totalRankings : 'None'}
            />
            <KeyValue
              label="Rankings you show"
              value={totalRankings ? visibleRankings : '—'}
            />
            <KeyValue
              label="Rankings hidden"
              value={hiddenRankings || (totalRankings ? 'None' : '—')}
            />
            <KeyValue
              label="Posts without files"
              value={withoutAssets}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
