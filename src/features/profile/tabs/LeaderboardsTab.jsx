import { useEffect, useMemo, useState } from 'react';

const DEFAULT_GENERATE_API_ORIGIN =
  (import.meta?.env?.VITE_GENERATE_API_ORIGIN && String(import.meta.env.VITE_GENERATE_API_ORIGIN)) ||
  'http://localhost:3010';

const PERSONA_COLORS = {
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

const PERSONA_SECTION_ORDER = ['productivite', 'securite', 'popularite'];

const PERSONA_SECTION_LABEL = {
  productivite: 'PRODUCTIVITY LEADERBOARDS',
  securite: 'SECURITY LEADERBOARDS',
  popularite: 'POPULARITY LEADERBOARDS',
};

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

  const grouped = useMemo(() => {
    const out = { productivite: [], securite: [], popularite: [] };
    for (const b of leaderboards) {
      const key = out[b.persona] ? b.persona : 'productivite';
      out[key].push(b);
    }
    return out;
  }, [leaderboards]);

  return (
    <div className="profile-leaderboards-stack">
      {PERSONA_SECTION_ORDER.map((personaKey) => {
        const boards = grouped[personaKey];
        if (!boards || boards.length === 0) return null;
        return (
          <section
            key={personaKey}
            className={`profile-leaderboards-section profile-leaderboards-section--${personaKey}`}
            style={{ '--persona-accent': PERSONA_COLORS[personaKey] }}
          >
            <h2 className="profile-leaderboards-section__title">
              {PERSONA_SECTION_LABEL[personaKey]}
            </h2>
            <div className="profile-leaderboards-grid">
              {boards.map((board) => (
                <LeaderboardCard key={board.boardId} board={board} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
