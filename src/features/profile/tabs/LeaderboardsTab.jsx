import { useMemo } from 'react';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';
import { useProfileLeaderboards } from '@/features/profile/useProfileLeaderboards.js';

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

function ordinalSuffix(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n)) return '';
  const v = Math.abs(Math.trunc(n)) % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (v % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function LeaderboardCard({ board }) {
  const rank = Number(board.userRank);
  const hasRank = Number.isFinite(rank);

  return (
    <article className="profile-leaderboard-card">
      <header className="profile-leaderboard-card__head">
        <div>
          <p className="profile-leaderboard-card__eyebrow">leaderboards</p>
          <h3 className="profile-leaderboard-card__title">{board.title}</h3>
        </div>
        <span className="profile-leaderboard-card__rank">
          {hasRank ? Math.trunc(rank) : '—'}
          {hasRank ? <sup>{ordinalSuffix(rank)}</sup> : null}
        </span>
      </header>

      <ol className="profile-leaderboard-card__rows" aria-label={`${board.title} standings`}>
        {(board.entries || []).map((entry) => {
          const isBot = entry.source === 'bot';
          return (
          <li
            key={`${board.boardId}-${entry.rank}-${entry.handle}-${entry.isUser ? 'self' : 'clone'}`}
            className={`profile-leaderboard-row${entry.isUser ? ' is-self' : ''}`}
          >
            <span className="profile-leaderboard-row__rank">{entry.rank}</span>
            <ProfileAvatarLink
              className="profile-leaderboard-row__avatar"
              imgClassName="profile-leaderboard-row__avatar-img"
              initialsClassName="profile-leaderboard-row__avatar-initials"
              avatarSrc={isBot ? null : (entry.avatarSrc || null)}
              avatarInitials={isBot ? entry.avatarInitials : null}
            />
            <span className="profile-leaderboard-row__name">{entry.name}</span>
            <span className="profile-leaderboard-row__score">{formatScore(entry.score)}</span>
          </li>
          );
        })}
      </ol>
    </article>
  );
}

export default function LeaderboardsTab({ profile }) {
  const { leaderboards } = useProfileLeaderboards(profile);

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
