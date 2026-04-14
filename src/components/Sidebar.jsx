export default function Sidebar({ globalScore, scoreSubtext }) {
  const score =
    globalScore != null && Number.isFinite(Number(globalScore))
      ? Number(globalScore)
      : '—';
  const sub =
    scoreSubtext && String(scoreSubtext).trim()
      ? scoreSubtext
      : '—';

  return (
    <aside className="sidebar">
      <div className="sidebar-card logo-card">projectName</div>
      <nav className="sidebar-card nav-card" aria-label="Main">
        <div className="nav-item">Search</div>
        <div className="nav-item">DMs</div>
        <div className="nav-item active">Profile</div>
        <div className="nav-item">Home</div>
        <div className="nav-item">Badges</div>
        <div className="nav-item">Rankings</div>
      </nav>
      <div className="sidebar-card my-score-card">
        <div className="score-label-tiny">My Score</div>
        <div className="my-score-num">{score}</div>
        <div className="my-score-sub">{sub}</div>
      </div>
    </aside>
  );
}
