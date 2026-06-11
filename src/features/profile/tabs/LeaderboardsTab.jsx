import { useMemo, useState } from 'react';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';
import LeaderboardRationaleView from '@/features/inferenceChain/LeaderboardRationaleView.jsx';
import { useProfileLeaderboards, profileViewerSlug } from '@/features/profile/useProfileLeaderboards.js';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { enrichProfileLeaderboardForRationale } from '@/lib/enrichProfileLeaderboard.js';

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

function directorySlugsFromBoards(boards) {
  const slugs = new Set();
  for (const board of boards) {
    for (const entry of board?.entries ?? []) {
      const slug = String(entry?.slug ?? '').trim();
      if (slug) slugs.add(slug);
    }
  }
  return [...slugs];
}

// hiddenMode: 'none' | 'board' (whole card hidden — the owner hid this board).
// Individual rows redact independently via each entry's global `selfHidden` flag.
export function LeaderboardCard({
  board,
  hiddenMode = 'none',
  expanded = false,
  onToggleExpand,
  authorSlug = null,
  onOpenProfile = null,
  leaderboardDirectorySlugs = [],
}) {
  const rank = Number(board.userRank);
  const hasRank = Number.isFinite(rank);
  const boardHidden = hiddenMode === 'board';
  const title = String(board.title ?? 'Leaderboard');
  const canExpand = !boardHidden && typeof onToggleExpand === 'function';

  const rationaleLeaderboard = useMemo(
    () => enrichProfileLeaderboardForRationale(board),
    [board],
  );

  const openAnalysis = () => {
    if (!canExpand || expanded) return;
    onToggleExpand();
  };

  const handleExpand = (event) => {
    if (!canExpand || expanded) return;
    const nested = event.target.closest('button, a, .profile-avatar-link');
    if (nested && nested !== event.currentTarget) return;
    event.preventDefault();
    openAnalysis();
  };

  return (
    <article
      className={`profile-leaderboard-card${boardHidden ? ' profile-leaderboard-card--hidden' : ''}${expanded ? ' profile-leaderboard-card--analysis' : ''}${canExpand && !expanded ? ' profile-leaderboard-card--expandable' : ''}`}
      {...(canExpand && !expanded
        ? {
            tabIndex: 0,
            'aria-expanded': expanded,
            onClick: handleExpand,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAnalysis();
              }
            },
          }
        : {})}
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

      {!expanded ? (
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
      ) : (
        <div className="profile-leaderboard-card__analysis">
          <button
            type="button"
            className="profile-leaderboard-card__analysis-back"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand?.();
            }}
            aria-label="Back to standings"
          />
          <div className="profile-leaderboard-card__analysis-body">
            <LeaderboardRationaleView
              compact
              leaderboard={rationaleLeaderboard}
              authorSlug={authorSlug}
              onOpenProfile={onOpenProfile}
              leaderboardDirectorySlugs={leaderboardDirectorySlugs}
            />
          </div>
        </div>
      )}

      {canExpand && !expanded ? (
        <button
          type="button"
          className="profile-leaderboard-card__hint"
          onClick={(event) => {
            event.stopPropagation();
            openAnalysis();
          }}
        >
          Tap for analysis
        </button>
      ) : null}

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

export default function LeaderboardsTab({
  profile,
  isOwnProfile = true,
  onOpenProfile = null,
  leaderboardDirectorySlugs = null,
}) {
  const { leaderboards } = useProfileLeaderboards(profile);
  const { isLeaderboardSelfHidden } = useLiveScoring();
  const [expandedBoardId, setExpandedBoardId] = useState(null);

  const authorSlug = profileViewerSlug(profile);
  const directorySlugs = useMemo(() => {
    if (Array.isArray(leaderboardDirectorySlugs) && leaderboardDirectorySlugs.length) {
      return leaderboardDirectorySlugs;
    }
    return directorySlugsFromBoards(leaderboards);
  }, [leaderboardDirectorySlugs, leaderboards]);

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
                const ownerHidBoard =
                  Boolean(board.entries?.find((e) => e.isUser)?.selfHidden)
                  || (isOwnProfile && isLeaderboardSelfHidden(board.boardId));
                return (
                  <LeaderboardCard
                    key={board.boardId}
                    board={board}
                    hiddenMode={ownerHidBoard ? 'board' : 'none'}
                    expanded={expandedBoardId === board.boardId}
                    onToggleExpand={() => {
                      setExpandedBoardId((prev) => (prev === board.boardId ? null : board.boardId));
                    }}
                    authorSlug={authorSlug}
                    onOpenProfile={onOpenProfile}
                    leaderboardDirectorySlugs={directorySlugs}
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
