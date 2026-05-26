import { useEffect, useState } from 'react';

const DEFAULT_GENERATE_API_ORIGIN =
  (import.meta?.env?.VITE_GENERATE_API_ORIGIN && String(import.meta.env.VITE_GENERATE_API_ORIGIN)) ||
  'http://localhost:3010';

function formatScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toString();
}

function LeaderboardCard({ board }) {
  const others = (board.entries || []).filter((entry) => !entry.isUser);

  return (
    <article className="profile-leaderboard-card">
      <header className="profile-leaderboard-card__head">
        <div>
          <p className="profile-leaderboard-card__eyebrow">leaderboards</p>
          <h3 className="profile-leaderboard-card__title">{board.title}</h3>
        </div>
        <span className="profile-leaderboard-card__rank">#{board.userRank}</span>
      </header>

      <ol className="profile-leaderboard-card__rows" aria-label={`${board.title} standings`}>
        {(board.entries || []).map((entry) => (
          <li
            key={`${board.boardId}-${entry.rank}-${entry.handle}-${entry.isUser ? 'self' : 'clone'}`}
            className={`profile-leaderboard-row${entry.isUser ? ' is-self' : ''}`}
          >
            <span className="profile-leaderboard-row__rank">{entry.rank}</span>
            <span className="profile-leaderboard-row__name">{entry.name}</span>
            <span className="profile-leaderboard-row__score">{formatScore(entry.score)}</span>
          </li>
        ))}
      </ol>

      {others.length > 0 && (
        <p className="profile-leaderboard-card__hint">{board.hint}</p>
      )}
    </article>
  );
}

export default function LeaderboardsTab({
  profile,
  generateApiOrigin = DEFAULT_GENERATE_API_ORIGIN,
}) {
  const [leaderboards, setLeaderboards] = useState([]);

  useEffect(() => {
    if (!profile) {
      setLeaderboards([]);
      return undefined;
    }

    const controller = new AbortController();
    async function loadLeaderboards() {
      try {
        const res = await fetch(`${generateApiOrigin}/api/leaderboards`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!controller.signal.aborted) {
          setLeaderboards(Array.isArray(json.leaderboards) ? json.leaderboards : []);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') setLeaderboards([]);
      }
    }

    loadLeaderboards();
    return () => controller.abort();
  }, [generateApiOrigin, profile]);

  return (
    <div className="profile-leaderboards-grid">
      {leaderboards.map((board) => (
        <LeaderboardCard key={board.boardId} board={board} />
      ))}
    </div>
  );
}
