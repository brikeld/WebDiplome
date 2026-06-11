import { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';
import LeaderboardRationaleView from '@/features/inferenceChain/LeaderboardRationaleView.jsx';
import { useProfileLeaderboards, profileViewerSlug } from '@/features/profile/useProfileLeaderboards.js';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { enrichProfileLeaderboardForRationale } from '@/lib/enrichProfileLeaderboard.js';
import { filterProfileLeaderboards } from '@/lib/profileUtils.js';

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

function LeaderboardAnalysisModal({
  board,
  persona,
  authorSlug,
  onOpenProfile,
  leaderboardDirectorySlugs,
  onClose,
}) {
  const rationaleLeaderboard = useMemo(
    () => enrichProfileLeaderboardForRationale(board),
    [board],
  );
  const accentColor = PERSONA_COLORS[persona] ?? '#759aef';
  const rank = Number(board.userRank);
  const hasRank = Number.isFinite(rank);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleOpenProfile = useCallback(
    (...args) => { onClose(); onOpenProfile?.(...args); },
    [onClose, onOpenProfile],
  );

  return createPortal(
    <div
      className="lb-analysis-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={board.title ?? 'Leaderboard analysis'}
    >
      <div
        className="lb-analysis-modal"
        style={{ '--lb-modal-accent': accentColor }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lb-analysis-modal__head">
          <button
            type="button"
            className="lb-analysis-modal__close"
            onClick={onClose}
            aria-label="Close analysis"
          />
          <div className="lb-analysis-modal__head-info">
            <p className="lb-analysis-modal__eyebrow">leaderboards</p>
            <h3 className="lb-analysis-modal__title">{board.title ?? 'Leaderboard'}</h3>
          </div>
          {hasRank && (
            <span className="lb-analysis-modal__rank">
              {Math.trunc(rank)}
              <sup>{ordinalSuffix(rank)}</sup>
            </span>
          )}
        </header>

        <div
          className="lb-analysis-modal__body"
          style={{
            '--lbx-accent': accentColor,
            '--tell-pill-accent': accentColor,
          }}
        >
          <LeaderboardRationaleView
            leaderboard={rationaleLeaderboard}
            authorSlug={authorSlug}
            onOpenProfile={handleOpenProfile}
            leaderboardDirectorySlugs={leaderboardDirectorySlugs}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function LeaderboardCard({
  board,
  hiddenMode = 'none',
  onOpenAnalysis = null,
  authorSlug = null,
  onOpenProfile = null,
  leaderboardDirectorySlugs = [],
}) {
  const rank = Number(board.userRank);
  const hasRank = Number.isFinite(rank);
  const boardHidden = hiddenMode === 'board';
  const title = String(board.title ?? 'Leaderboard');
  const canOpen = !boardHidden && typeof onOpenAnalysis === 'function';
  const [tapping, setTapping] = useState(false);

  const triggerTap = () => {
    if (!canOpen || tapping) return;
    setTapping(true);
    setTimeout(() => {
      setTapping(false);
      onOpenAnalysis(board);
    }, 160);
  };

  const handleCardClick = (event) => {
    if (!canOpen) return;
    const nested = event.target.closest('button, a, .profile-avatar-link');
    if (nested && nested !== event.currentTarget) return;
    event.preventDefault();
    triggerTap();
  };

  return (
    <article
      className={`profile-leaderboard-card${boardHidden ? ' profile-leaderboard-card--hidden' : ''}${canOpen ? ' profile-leaderboard-card--expandable' : ''}${tapping ? ' profile-leaderboard-card--tapping' : ''}`}
      {...(canOpen
        ? {
            tabIndex: 0,
            'aria-label': `Open analysis for ${title}`,
            onClick: handleCardClick,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                triggerTap();
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

      {canOpen ? (
        <button
          type="button"
          className="profile-leaderboard-card__hint"
          onClick={(event) => { event.stopPropagation(); triggerTap(); }}
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
  const [analysisModal, setAnalysisModal] = useState(null);

  const visibleLeaderboards = useMemo(
    () => filterProfileLeaderboards(leaderboards),
    [leaderboards],
  );

  const authorSlug = profileViewerSlug(profile);
  const directorySlugs = useMemo(() => {
    if (Array.isArray(leaderboardDirectorySlugs) && leaderboardDirectorySlugs.length) {
      return leaderboardDirectorySlugs;
    }
    return directorySlugsFromBoards(visibleLeaderboards);
  }, [leaderboardDirectorySlugs, visibleLeaderboards]);

  const grouped = useMemo(() => {
    const out = { productivite: [], securite: [], popularite: [] };
    for (const b of visibleLeaderboards) {
      const key = out[b.persona] ? b.persona : 'productivite';
      out[key].push(b);
    }
    return out;
  }, [visibleLeaderboards]);

  return (
    <>
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
                      onOpenAnalysis={(b) =>
                        setAnalysisModal({ board: b, persona: personaKey })
                      }
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

      {analysisModal && (
        <LeaderboardAnalysisModal
          board={analysisModal.board}
          persona={analysisModal.persona}
          authorSlug={authorSlug}
          onOpenProfile={onOpenProfile}
          leaderboardDirectorySlugs={directorySlugs}
          onClose={() => setAnalysisModal(null)}
        />
      )}
    </>
  );
}
