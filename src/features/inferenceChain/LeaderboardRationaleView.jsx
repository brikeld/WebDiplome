import { useState, useEffect, useMemo } from 'react';
import {
  atmosphericVerdict,
  parseUserSignals,
  fallbackClimbTip,
  BOARD_DESCRIPTIONS,
  positionCommentFromPhrase,
} from './leaderboardRationaleUtils.js';
import { isLeaderboardBotEntry } from '@/lib/leaderboardEntryVisibility.js';
import { leaderboardEntryProfileSlug } from '@/lib/leaderboardProfileSlug.js';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';
import { useTellMeMoreLoading } from './useTellMeMoreLoading.js';
import TellMeMoreLoadingOverlay from './TellMeMoreLoadingOverlay.jsx';

function OtherUserCard({
  entry,
  rationale,
  authorSlug,
  directorySlugs,
  onOpenProfile,
}) {
  const isBot = isLeaderboardBotEntry(entry);
  const entrySlug = leaderboardEntryProfileSlug(entry, authorSlug, directorySlugs);
  const openLeaderboards = !entry.hidden && entrySlug && onOpenProfile
    ? () => onOpenProfile('leaderboards', entrySlug)
    : undefined;
  const positionComment = positionCommentFromPhrase(rationale?.phrase);
  const displayName = entry.name ? String(entry.name).trim() : '';

  return (
    <li className={`lb2__other${entry.hidden ? ' is-hidden' : ''}`}>
      <div className="lb2__other-meta">
        <span className="lb2__other-rank">#{entry.rank}</span>
      </div>
      <div className="lb2__other-body">
        <div className="lb2__other-portrait">
          <ProfileAvatarLink
            className="lb2__other-avatar"
            imgClassName="lb2__other-avatar-img"
            initialsClassName="lb2__other-avatar-initials"
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
        </div>
        {entry.hidden ? (
          <p className="lb2__other-phrase">position hidden</p>
        ) : (
          <>
            {positionComment ? (
              <p className="lb2__other-comment">{positionComment}</p>
            ) : null}
            {displayName ? (
              <cite className="lb2__other-cite">{displayName}</cite>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

export default function LeaderboardRationaleView({
  leaderboard,
  holdLoadingOverlay = false,
  authorSlug = null,
  onOpenProfile = null,
  leaderboardDirectorySlugs = [],
}) {
  const [showOthers, setShowOthers] = useState(false);
  const [activeSignal, setActiveSignal] = useState(null);

  const boardId = leaderboard?.boardId;
  const { ready, loadingKey } = useTellMeMoreLoading([boardId], { blocked: holdLoadingOverlay });

  const directorySlugs = useMemo(
    () => new Set(
      (Array.isArray(leaderboardDirectorySlugs) ? leaderboardDirectorySlugs : [])
        .map((s) => String(s ?? '').trim())
        .filter(Boolean),
    ),
    [leaderboardDirectorySlugs],
  );

  useEffect(() => {
    setShowOthers(false);
    setActiveSignal(null);
  }, [boardId]);

  if (!leaderboard || !Array.isArray(leaderboard.entries) || leaderboard.entries.length === 0) {
    return (
      <div className="lb2 lb2--empty is-ready">
        <p className="lb2__value">Leaderboard data is unavailable for this post.</p>
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
  const boardDesc = BOARD_DESCRIPTIONS[boardId] ?? null;

  // Others screen: real users always visible; only bots use cloneHidden[].
  let botIdx = -1;
  const cloneEntries = entries
    .filter((e) => !e.isUser)
    .map((entry) => {
      if (!isLeaderboardBotEntry(entry)) {
        return { ...entry, hidden: false };
      }
      botIdx += 1;
      return { ...entry, hidden: Boolean(cloneHidden[botIdx]) };
    });

  const handleSignalClick = (i) => {
    setActiveSignal((prev) => (prev === i ? null : i));
  };

  return (
    <div className={`lb2${ready ? ' is-ready' : ''}`}>
      <TellMeMoreLoadingOverlay loadingKey={loadingKey} />

      {/* ── Main screen ─────────────────────────────────────── */}
      <div
        className={`lb2__screen lb2__screen--main${showOthers ? ' is-gone' : ''}${signals.length === 0 ? ' lb2__screen--no-signals' : ''}`}
      >

        {/* Rank tile */}
        <div className="lb2__tile lb2__tile--rank">
          <span className="lb2__rank-label">RANK</span>
          <span className="lb2__rank-value">#{resolvedUserRank ?? '—'}</span>
          <span className="lb2__rank-of">of {entries.length}</span>
        </div>

        {/* Verdict tile */}
        <div className="lb2__tile lb2__tile--verdict">
          <div className="lb2__head">
            <span className="lb2__label">WHY THE SYSTEM</span>
          </div>
          <p className="lb2__value">{verdict}</p>
          {boardDesc ? (
            <p className="lb2__value lb2__value--small">{boardDesc}</p>
          ) : null}
        </div>

        {/* Improve tile */}
        <div className="lb2__tile lb2__tile--improve">
          <div className="lb2__head">
            <span className="lb2__label">HOW CAN YOU IMPROVE</span>
          </div>
          <p className="lb2__value lb2__value--climb">{tip}</p>
        </div>

        {/* Signals tile */}
        {signals.length > 0 ? (
          <div className="lb2__tile lb2__tile--signals">
            <div className="lb2__head">
              <span className="lb2__label">WHAT COUNTED</span>
            </div>
            <div className="lb2__sig-wrap">
              <div className="lb2__sig-grid">
                {signals.map((sig, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`lb2__sig${sig.shown?.length ? ' lb2__sig--named' : ''}${activeSignal === i ? ' is-active' : ''}`}
                    onClick={() => handleSignalClick(i)}
                  >
                    <span className="lb2__sig-copy">
                      <span className="lb2__sig-text">{sig.label}</span>
                      {sig.shown?.length > 0 ? (
                        <span className="lb2__sig-examples">
                          {sig.shown.join(' · ')}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>

              {activeSignal !== null && signals[activeSignal] ? (
                <div className="lb2__sig-detail">
                  <div className="lb2__sig-detail-block">
                    <span className="lb2__label">WHY IT COUNTED</span>
                    <p className="lb2__value lb2__value--reason">
                      {signals[activeSignal].detail}
                    </p>
                  </div>
                  {signals[activeSignal].shown?.length > 0 ? (
                    <div className="lb2__sig-detail-block">
                      <span className="lb2__label">DETECTED</span>
                      <ul className="lb2__sig-example-list">
                        {signals[activeSignal].shown.map((name, idx) => (
                          <li key={idx} className="lb2__sig-example-item">{name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* CTA → others */}
        <button
          type="button"
          className="lb2__cta"
          onClick={() => setShowOthers(true)}
        >
          <span>OTHER USERS</span>
          <span className="lb2__cta-arrow">→</span>
        </button>
      </div>

      {/* ── Others screen ───────────────────────────────────── */}
      <div className={`lb2__screen lb2__screen--others${showOthers ? ' is-active' : ''}`}>
        <div className="lb2__others-head">
          <button
            type="button"
            className="lb2__back"
            onClick={() => setShowOthers(false)}
          >
            ← BACK
          </button>
          <span className="lb2__label lb2__label--head">OTHER USERS</span>
        </div>

        <ol className="lb2__others-list">
          {cloneEntries.map((entry) => {
            const rat = Array.isArray(rationales)
              ? rationales.find((r) => r.rank === entry.rank)
              : null;
            return (
              <OtherUserCard
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
