import { useMemo } from 'react';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';
import { useProfileLeaderboards } from '@/features/profile/useProfileLeaderboards.js';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';

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


// hiddenMode: 'none' | 'board' (whole card hidden — the owner hid this board).
// Individual rows redact independently via each entry's global `selfHidden` flag.
export function LeaderboardCard({ board, hiddenMode = 'none' }) {
  const rank = Number(board.userRank);
  const hasRank = Number.isFinite(rank);
  const boardHidden = hiddenMode === 'board';
  const title = String(board.title ?? 'Leaderboard');

  return (
    <article
      className={`profile-leaderboard-card${boardHidden ? ' profile-leaderboard-card--hidden' : ''}`}
    >
      <header className="profile-leaderboard-card__head">
        <div>
          <p className="profile-leaderboard-card__eyebrow">leaderboards</p>
          <h3 className="profile-leaderboard-card__title">{title}</h3>
        </div>
        <span className="profile-leaderboard-card__rank">
          {hasRank ? Math.trunc(rank) : '—'}
          {hasRank ? <sup>{ordinalSuffix(rank)}</sup> : null}
        </span>
      </header>

      <ol className="profile-leaderboard-card__rows" aria-label={`${title} standings`}>
        {(board.entries || []).map((entry) => {
          const isBot = entry.source === 'bot';
          const rowHidden = !boardHidden && entry.source === 'real' && Boolean(entry.selfHidden);
          return (
          <li
            key={`${board.boardId}-${entry.rank}-${entry.handle}-${entry.isUser ? 'self' : 'clone'}`}
            className={`profile-leaderboard-row${entry.isUser ? ' is-self' : ''}${rowHidden ? ' profile-leaderboard-row--hidden' : ''}`}
            aria-label={rowHidden ? `Hidden row for ${entry.name}` : undefined}
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
            {rowHidden ? (
              <div className="profile-leaderboard-row__hidden-notice" role="status">
                <span className="profile-leaderboard-row__hidden-notice-title">
                  Position hidden
                </span>
              </div>
            ) : null}
          </li>
          );
        })}
      </ol>

      {boardHidden ? (
        <div className="profile-leaderboard-card__hidden-notice" role="status">
          <span className="profile-leaderboard-card__hidden-notice-title">
            Leaderboard hidden
          </span>
          <p>You hid your place on this leaderboard.</p>
        </div>
      ) : null}
    </article>
  );
}

export default function LeaderboardsTab({ profile, isOwnProfile = true }) {
  const { leaderboards } = useProfileLeaderboards(profile);
  const { isLeaderboardSelfHidden } = useLiveScoring();

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
              {boards.map((board) => {
                // Whole card hidden when the profile OWNER hid this board: their
                // row (isUser) carries the global selfHidden flag. On your own
                // profile also honour the viewer-local flag for instant feedback.
                const ownerHidBoard =
                  Boolean(board.entries?.find((e) => e.isUser)?.selfHidden)
                  || (isOwnProfile && isLeaderboardSelfHidden(board.boardId));
                return (
                  <LeaderboardCard
                    key={board.boardId}
                    board={board}
                    hiddenMode={ownerHidBoard ? 'board' : 'none'}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
