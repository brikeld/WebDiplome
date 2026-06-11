import { useState, useEffect } from 'react';
import {
  atmosphericVerdict,
  parseUserSignals,
  fallbackClimbTip,
  BOARD_DESCRIPTIONS,
  BOARD_TITLES,
  positionCommentFromPhrase,
} from './leaderboardRationaleUtils.js';
import { isLeaderboardBotEntry } from '@/lib/leaderboardEntryVisibility.js';
import { leaderboardEntryProfileSlug } from '@/lib/leaderboardProfileSlug.js';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';

/**
 * Leaderboard "Tell Me More".
 *
 * Shares the spacing / typography / fill model of the normal-post panel, but
 * carries its own identity: black header pills + the post's persona accent
 * (the normal panel uses plain-black titles + pastel tiles). Two screens:
 *   1. main  → rank hero, why-this-rank, how-to-climb, what-counted (chips).
 *   2. others → what every other user "said" about their position.
 *
 * Content is covered by the parent panel loading shimmer, then staggers in.
 */

function OtherUserRow({ entry, rationale, authorSlug, directorySlugs, onOpenProfile }) {
  const isBot = isLeaderboardBotEntry(entry);
  const entrySlug = leaderboardEntryProfileSlug(entry, authorSlug, directorySlugs);
  const openLeaderboards = !entry.hidden && entrySlug && onOpenProfile
    ? () => onOpenProfile('leaderboards', entrySlug)
    : undefined;
  const comment = positionCommentFromPhrase(rationale?.phrase);
  const displayName = entry.name ? String(entry.name).trim() : '';

  return (
    <li className={`lbx__other${entry.hidden ? ' is-hidden' : ''}`}>
      <span className="lbx__other-rank">#{entry.rank}</span>
      <ProfileAvatarLink
        className="lbx__other-avatar"
        imgClassName="lbx__other-avatar-img"
        initialsClassName="lbx__other-avatar-initials"
        onOpenProfile={openLeaderboards}
        ariaLabel={
          entry.hidden
            ? 'Position hidden'
            : displayName
              ? `View ${displayName}'s leaderboards`
              : 'View leaderboards'
        }
        avatarSrc={isBot ? null : (entry.avatarSrc || null)}
        avatarInitials={isBot ? entry.avatarInitials : null}
      />
      <div className="lbx__other-text">
        {entry.hidden ? (
          <p className="lbx__other-phrase lbx__other-phrase--hidden">Position hidden</p>
        ) : (
          <>
            <p className="lbx__other-phrase">{comment ? `“${comment}”` : '—'}</p>
            {displayName ? <cite className="lbx__other-name">{displayName}</cite> : null}
          </>
        )}
      </div>
    </li>
  );
}

export default function LeaderboardRationaleView({
  leaderboard,
  authorSlug = null,
  onOpenProfile = null,
  leaderboardDirectorySlugs = [],
}) {
  const [showOthers, setShowOthers] = useState(false);
  const [activeSignal, setActiveSignal] = useState(null);

  const boardId = leaderboard?.boardId;

  useEffect(() => {
    setShowOthers(false);
    setActiveSignal(null);
  }, [boardId]);

  if (!leaderboard || !Array.isArray(leaderboard.entries) || leaderboard.entries.length === 0) {
    return (
      <div className="lbx lbx--empty">
        <p className="lbx__empty">Leaderboard data is unavailable for this post.</p>
      </div>
    );
  }

  const {
    entries,
    cloneHidden = [false, false, false, false],
    rationales,
    climbTip,
    userRank,
    hint,
  } = leaderboard;

  const userEntry = entries.find((e) => e.isUser);
  const resolvedUserRank = userRank ?? userEntry?.rank ?? null;
  const userRationale = Array.isArray(rationales)
    ? rationales.find((r) => r.rank === (userEntry?.rank ?? resolvedUserRank))
    : null;
  const signalSource = userRationale?.signal ?? hint ?? '';
  const signals = parseUserSignals(signalSource, boardId);
  const tip = climbTip || fallbackClimbTip(boardId, resolvedUserRank);
  const verdict = atmosphericVerdict(resolvedUserRank, boardId);
  const boardTitle = BOARD_TITLES[boardId] ?? null;
  const boardDesc = BOARD_DESCRIPTIONS[boardId] ?? null;

  const directorySlugs = new Set(
    (Array.isArray(leaderboardDirectorySlugs) ? leaderboardDirectorySlugs : [])
      .map((s) => String(s ?? '').trim())
      .filter(Boolean),
  );

  // Others screen: real users always visible; only bots use cloneHidden[].
  let botIdx = -1;
  const cloneEntries = entries
    .filter((e) => !e.isUser)
    .map((entry) => {
      if (!isLeaderboardBotEntry(entry)) return { ...entry, hidden: false };
      botIdx += 1;
      return { ...entry, hidden: Boolean(cloneHidden[botIdx]) };
    });

  const openSignal = activeSignal !== null ? signals[activeSignal] : null;

  return (
    <div className="lbx">
      {/* ── Main screen ─────────────────────────────────────── */}
      <div className={`lbx__screen lbx__screen--main${showOthers ? ' is-gone' : ''}`}>
        {/* Rank hero */}
        <div className="lbx__rank">
          <span className="lbx__rank-num">#{resolvedUserRank ?? '—'}</span>
          <span className="lbx__rank-side">
            <span className="lbx__rank-label">{boardTitle ? boardTitle : 'YOUR RANK'}</span>
            <span className="lbx__rank-of">out of {entries.length}{boardDesc ? ` · ${boardDesc}` : ''}</span>
          </span>
        </div>

        {/* Why this rank */}
        <section className="lbx__sec">
          <header className="lbx__title">WHY THIS RANK</header>
          <p className="lbx__body">{verdict}</p>
        </section>

        {/* How to climb */}
        <section className="lbx__sec">
          <header className="lbx__title">HOW TO CLIMB</header>
          <p className="lbx__body">{tip}</p>
        </section>

        {/* What counted → chips; clicking one swaps the grid for its detail */}
        {signals.length > 0 ? (
          <section className={`lbx__sec lbx__sec--signals${openSignal ? ' is-detail' : ''}`}>
            <header className="lbx__title">WHAT COUNTED</header>

            {openSignal ? (
              <div className="lbx__detail">
                <div className="lbx__detail-head">
                  <button
                    type="button"
                    className="lbx__detail-back"
                    onClick={() => setActiveSignal(null)}
                    aria-label="Back to signals"
                  >
                    ←
                  </button>
                  <span className="lbx__detail-name">{openSignal.label}</span>
                </div>
                <p className="lbx__body">{openSignal.detail}</p>
                {openSignal.shown?.length > 0 ? (
                  <div className="lbx__detail-tags">
                    {openSignal.shown.map((name, idx) => (
                      <span key={idx} className="lbx__detail-tag">{name}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="lbx__chips">
                {signals.map((sig, i) => (
                  <button
                    key={i}
                    type="button"
                    className="lbx__chip"
                    onClick={() => setActiveSignal(i)}
                  >
                    <span className="lbx__chip-label">{sig.label}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* Others CTA */}
        <button
          type="button"
          className="lbx__others-btn"
          onClick={() => setShowOthers(true)}
        >
          <span>OTHER USERS</span>
          <span className="lbx__others-arrow" aria-hidden="true">→</span>
        </button>
      </div>

      {/* ── Others screen ───────────────────────────────────── */}
      <div className={`lbx__screen lbx__screen--others${showOthers ? ' is-active' : ''}`}>
        <header className="lbx__others-head">
          <button
            type="button"
            className="lbx__back"
            onClick={() => setShowOthers(false)}
            aria-label="Back"
          >
            ←
          </button>
          <span className="lbx__others-title">OTHER USERS</span>
        </header>

        <ol className="lbx__others-list">
          {cloneEntries.map((entry) => {
            const rat = Array.isArray(rationales)
              ? rationales.find((r) => r.rank === entry.rank)
              : null;
            return (
              <OtherUserRow
                key={entry.rank}
                entry={entry}
                rationale={rat}
                authorSlug={authorSlug}
                directorySlugs={directorySlugs}
                onOpenProfile={onOpenProfile}
              />
            );
          })}
        </ol>
      </div>
    </div>
  );
}
