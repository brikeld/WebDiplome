import { useMemo } from 'react';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';
import { useProfileLeaderboards } from '@/features/profile/useProfileLeaderboards.js';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { slugsReferToSameAccount } from '@/lib/accountDeletionClient.js';

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

function slugsMatch(a, b) {
  const left = String(a ?? '').trim();
  const right = String(b ?? '').trim();
  if (!left || !right) return false;
  return left === right || slugsReferToSameAccount(left, right);
}

export function LeaderboardCard({ board, hiddenMode = 'none', ownedProfileSlug = null }) {
  const rank = Number(board.userRank);
  const hasRank = Number.isFinite(rank);
  const fullHidden = hiddenMode === 'full';
  const rowHidden = hiddenMode === 'row';
  const title = String(board.title ?? 'Leaderboard');
  const hiddenNoticeCopy = fullHidden
    ? {
        title: 'Position hidden',
        body: 'You chose to hide your place on this leaderboard.',
      }
    : rowHidden
      ? {
          title: 'Position hidden',
          body: 'This user hid their position on this leaderboard.',
        }
      : null;

  return (
    <article
      className={`profile-leaderboard-card${fullHidden ? ' profile-leaderboard-card--hidden' : ''}`}
      aria-label={fullHidden ? `Hidden ranking: ${title} standings` : undefined}
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
          const hideOwnedRow = rowHidden && entry.source === 'real' && slugsMatch(entry.slug, ownedProfileSlug);
          return (
          <li
            key={`${board.boardId}-${entry.rank}-${entry.handle}-${entry.isUser ? 'self' : 'clone'}`}
            className={`profile-leaderboard-row${entry.isUser ? ' is-self' : ''}${hideOwnedRow ? ' profile-leaderboard-row--hidden' : ''}`}
            aria-label={hideOwnedRow ? `Hidden row for ${entry.name}` : undefined}
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
            {hideOwnedRow ? (
              <div className="profile-leaderboard-row__hidden-notice" role="status">
                <span className="profile-leaderboard-row__hidden-notice-title">
                  {hiddenNoticeCopy?.title}
                </span>
                <p>{hiddenNoticeCopy?.body}</p>
              </div>
            ) : null}
          </li>
          );
        })}
      </ol>

      {fullHidden && hiddenNoticeCopy ? (
        <div className="profile-leaderboard-card__hidden-notice" role="status">
          <span className="profile-leaderboard-card__hidden-notice-title">
            {hiddenNoticeCopy.title}
          </span>
          <p>{hiddenNoticeCopy.body}</p>
        </div>
      ) : null}
    </article>
  );
}

export default function LeaderboardsTab({ profile, isOwnProfile = true, ownedProfileSlug = null }) {
  const { leaderboards } = useProfileLeaderboards(profile);
  const { isLeaderboardSelfHidden } = useLiveScoring();
  const resolvedOwnedProfileSlug =
    ownedProfileSlug ?? (isOwnProfile ? (profile?.slug ?? profile?.id ?? null) : null);

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
                <LeaderboardCard
                  key={board.boardId}
                  board={board}
                  hiddenMode={
                    isLeaderboardSelfHidden(board.boardId)
                      ? (isOwnProfile ? 'full' : 'row')
                      : 'none'
                  }
                  ownedProfileSlug={resolvedOwnedProfileSlug}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
