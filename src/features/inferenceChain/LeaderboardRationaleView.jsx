import { useState, useEffect } from 'react';
import {
  atmosphericVerdict,
  parseUserSignals,
  fallbackClimbTip,
  BOARD_DESCRIPTIONS,
  cloneRationaleSignal,
} from './leaderboardRationaleUtils.js';
import { isLeaderboardBotEntry } from '@/lib/leaderboardEntryVisibility.js';
import { useTellMeMoreLoading } from './useTellMeMoreLoading.js';
import TellMeMoreLoadingOverlay from './TellMeMoreLoadingOverlay.jsx';

function OtherUserAvatar({ entry }) {
  return (
    <span
      className={`lb2__other-avatar${entry.hidden ? ' lb2__other-avatar--hidden' : ''}`}
      aria-hidden
    >
      <span className="lb2__other-avatar-mock" />
    </span>
  );
}

export default function LeaderboardRationaleView({ leaderboard, holdLoadingOverlay = false }) {
  const [showOthers, setShowOthers] = useState(false);
  const [activeSignal, setActiveSignal] = useState(null);

  const boardId = leaderboard?.boardId;
  const { ready, loadingKey } = useTellMeMoreLoading([boardId], { blocked: holdLoadingOverlay });

  useEffect(() => {
    setShowOthers(false);
    setActiveSignal(null);
  }, [boardId]);

  if (!leaderboard || !Array.isArray(leaderboard.entries)) return null;

  const {
    entries,
    cloneHidden = [false, false, false, false],
    rationales,
    climbTip,
    userRank,
  } = leaderboard;

  const userEntry = entries.find((e) => e.isUser);
  const userRationale = Array.isArray(rationales)
    ? rationales.find((r) => r.rank === userEntry?.rank)
    : null;
  const signals = parseUserSignals(userRationale?.signal ?? '', boardId);
  const tip = climbTip || fallbackClimbTip(boardId, userRank);
  const verdict = atmosphericVerdict(userRank, boardId);
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
        className={`lb2__screen lb2__screen--main${showOthers ? ' is-gone' : ''}`}
        style={signals.length === 0 ? { gridTemplateRows: 'auto auto auto' } : undefined}
      >

        {/* Rank tile */}
        <div className="lb2__tile lb2__tile--rank">
          <span className="lb2__rank-label">RANK</span>
          <span className="lb2__rank-value">#{userRank ?? '—'}</span>
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
            const cloneSignal = cloneRationaleSignal(rat?.signal);
            return (
              <li
                key={entry.rank}
                className={`lb2__other${entry.hidden ? ' is-hidden' : ''}`}
              >
                <div className="lb2__other-meta">
                  <span className="lb2__other-rank">#{entry.rank}</span>
                  {!entry.hidden && cloneSignal ? (
                    <span className="lb2__other-score">{cloneSignal}</span>
                  ) : null}
                </div>
                <div className="lb2__other-body">
                  <div className="lb2__other-portrait">
                    <OtherUserAvatar entry={entry} />
                  </div>
                  {entry.hidden ? (
                    <p className="lb2__other-phrase">position hidden</p>
                  ) : (
                    <>
                      {rat?.phrase ? (
                        <blockquote className="lb2__other-quote">
                          <p className="lb2__other-quote-text">{rat.phrase}</p>
                        </blockquote>
                      ) : null}
                      {entry.name ? (
                        <cite className="lb2__other-cite">{entry.name}</cite>
                      ) : null}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
