import { useCallback, useEffect, useRef, useState } from 'react';
import HarvestScreen from '@/features/harvest/HarvestScreen.jsx';
import PersonaDeltaSummary from '@/features/harvest/PersonaDeltaSummary.jsx';
import GeneratingContentLabel from '@/features/harvest/GeneratingContentLabel.jsx';
import { personaToUiKey, resolveHideContentPersona } from '@/lib/personaScoreCompliance.js';

export default function DashboardTimerRow({
  highlightedPost,
  highlightedPostIsHidden,
  highlightedPostPersonaLabel,
  personaKey,
  personaColor,
  personaLabels,
  hideBlocked,
  confirmingHide,
  confirmingUnhide,
  hidePersonaUiKey: hidePersonaUiKeyProp,
  onCancelHide,
  onConfirmHide,
  onConfirmUnhide,
  dashboardLayout,
  harvestProgress,
  harvestError,
  personaDeltas,
  adjustedScores,
  postGen,
  profile,
  updateTimerLabel,
  updateRemainingMs,
  onGeneratePersonaPosts,
  accountFeaturesEnabled = true,
}) {
  const hidePersonaUiKey =
    hidePersonaUiKeyProp ??
    (highlightedPost ? personaToUiKey(resolveHideContentPersona(highlightedPost)) : null);
  const hideBlockedActive = hideBlocked && highlightedPost && !highlightedPostIsHidden;
  const confirmActive = confirmingHide && highlightedPost && !highlightedPostIsHidden;
  const confirmUnhideActive = confirmingUnhide && highlightedPost && highlightedPostIsHidden;
  const idleTimerActive = dashboardLayout.actionSlot === 'timer';
  const points = Math.abs(Number(highlightedPost?.systemDeltaPct) || 1);
  const restorePoints = points * 0.5;
  const restorePointsLabel =
    restorePoints % 1 === 0 ? String(restorePoints) : restorePoints.toFixed(1).replace(/\.0$/, '');
  const personaLabelLower = (
    highlightedPostPersonaLabel ?? personaLabels[personaKey] ?? 'Social'
  ).toLowerCase();
  const hideConfirmAccent = highlightedPost?.noteColor ?? personaColor;
  const timerStyle = { '--hide-pill-accent': hideConfirmAccent };
  const leaderboardSelected = Boolean(highlightedPost?.leaderboard);
  const timerBaseClass =
    'dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update';

  const COUNTDOWN_PULSE_MS = 5000;
  const [countdownPulseOn, setCountdownPulseOn] = useState(false);
  const prevRemainingMsRef = useRef(updateRemainingMs);
  const pulseEndTimerRef = useRef(null);

  const triggerCountdownPulse = useCallback(() => {
    if (!idleTimerActive) return;
    setCountdownPulseOn(true);
    if (pulseEndTimerRef.current) clearTimeout(pulseEndTimerRef.current);
    pulseEndTimerRef.current = setTimeout(() => {
      setCountdownPulseOn(false);
      pulseEndTimerRef.current = null;
    }, COUNTDOWN_PULSE_MS);
  }, [idleTimerActive]);

  useEffect(
    () => () => {
      if (pulseEndTimerRef.current) clearTimeout(pulseEndTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!idleTimerActive) {
      setCountdownPulseOn(false);
      return;
    }
    const prev = prevRemainingMsRef.current;
    prevRemainingMsRef.current = updateRemainingMs;
    const crossedZero = prev > 1000 && updateRemainingMs <= 1000;
    if (crossedZero) {
      triggerCountdownPulse();
    }
  }, [updateRemainingMs, idleTimerActive, triggerCountdownPulse]);

  const idleTimerClass = idleTimerActive
    ? ` dashboard-timer-card--idle-countdown${
        countdownPulseOn ? ' dashboard-timer-card--countdown-pulse' : ''
      }`
    : '';
  const idleTimerStyle = { '--persona-accent': personaColor };

  const renderTimerSlot = () => {
    if (hideBlockedActive) {
      const blockedLabel = (
        personaLabels[hidePersonaUiKey] ?? highlightedPostPersonaLabel ?? 'Social'
      ).toLowerCase();
      return (
        <div
          className={`${timerBaseClass} dashboard-timer-card--confirm dashboard-timer-card--confirm-blocked`}
          role="alertdialog"
          aria-labelledby="hide-blocked-title-inline"
          style={timerStyle}
        >
          <div className="dashboard-hide-confirm__body">
            <h3 id="hide-blocked-title-inline" className="dashboard-hide-confirm__title">
              {leaderboardSelected ? "Can't hide your ranking" : "Can't hide this post"}
            </h3>
            <p className="dashboard-hide-confirm__message">
              {leaderboardSelected ? (
                <>
                  Sorry, but you cannot hide your ranking, since your{' '}
                  <span className="dashboard-hide-confirm__chip">{blockedLabel}</span> persona score
                  is too low right now. Improve your score and try again.
                </>
              ) : (
                <>
                  Sorry, but you cannot hide this post, since your{' '}
                  <span className="dashboard-hide-confirm__chip">{blockedLabel}</span> persona score
                  is too low right now. Improve your score and try again.
                </>
              )}
            </p>
            <div className="dashboard-hide-confirm__actions">
              <button
                type="button"
                className="dashboard-hide-confirm__btn dashboard-hide-confirm__btn--cancel"
                onClick={onCancelHide}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (confirmUnhideActive) {
      return (
        <div
          className={`${timerBaseClass} dashboard-timer-card--confirm dashboard-timer-card--confirm-unhide`}
          role="alertdialog"
          aria-labelledby="unhide-confirm-title-inline"
          style={timerStyle}
        >
          <div className="dashboard-hide-confirm__body">
            <h3 id="unhide-confirm-title-inline" className="dashboard-hide-confirm__title">
              {leaderboardSelected ? 'Unhide your ranking?' : 'Unhide this post?'}
            </h3>
            <p className="dashboard-hide-confirm__message">
              {leaderboardSelected ? (
                <>
                  Showing your position again will restore{' '}
                  <span className="dashboard-hide-confirm__chip">+{restorePointsLabel}%</span> on your{' '}
                  {personaLabelLower} score and put your position back on this leaderboard.
                </>
              ) : (
                <>
                  If you unhide this post, you will regain{' '}
                  <span className="dashboard-hide-confirm__chip">+{restorePointsLabel}%</span> on your{' '}
                  {personaLabelLower} score and everyone will be able to see this post again.
                </>
              )}
            </p>
            <div className="dashboard-hide-confirm__actions">
              <button
                type="button"
                className="dashboard-hide-confirm__btn dashboard-hide-confirm__btn--cancel"
                onClick={onCancelHide}
              >
                {leaderboardSelected ? 'Stay hidden' : 'Keep hidden'}
              </button>
              <button
                type="button"
                className="dashboard-hide-confirm__btn dashboard-hide-confirm__btn--hide"
                onClick={onConfirmUnhide}
              >
                {leaderboardSelected ? 'Show ranking' : 'Unhide anyway'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (confirmActive) {
      return (
        <div
          className={`${timerBaseClass} dashboard-timer-card--confirm`}
          role="alertdialog"
          aria-labelledby="hide-confirm-title-inline"
          style={timerStyle}
        >
          <div className="dashboard-hide-confirm__body">
            <h3 id="hide-confirm-title-inline" className="dashboard-hide-confirm__title">
              {leaderboardSelected ? 'Hide your ranking?' : 'Hide this post?'}
            </h3>
            <p className="dashboard-hide-confirm__message">
              {leaderboardSelected ? (
                <>
                  Hiding your position will cost you{' '}
                  <span className="dashboard-hide-confirm__chip">-{points}%</span> on your{' '}
                  {personaLabelLower} score and remove your position from this leaderboard.
                </>
              ) : (
                <>
                  If you hide this post, you will lose{' '}
                  <span className="dashboard-hide-confirm__chip">-{points}%</span> on your{' '}
                  {personaLabelLower} score and no one else will be able to see this post.
                </>
              )}
            </p>
            <div className="dashboard-hide-confirm__actions">
              <button
                type="button"
                className="dashboard-hide-confirm__btn dashboard-hide-confirm__btn--cancel"
                onClick={onCancelHide}
              >
                {leaderboardSelected ? 'Stay visible' : 'Keep post'}
              </button>
              <button
                type="button"
                className="dashboard-hide-confirm__btn dashboard-hide-confirm__btn--hide"
                onClick={onConfirmHide}
              >
                {leaderboardSelected ? 'Hide ranking' : 'Hide anyway'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (dashboardLayout.actionSlot === 'harvest') {
      return (
        <div
          className={`${timerBaseClass} dashboard-timer-card--action-status dashboard-timer-card--harvest`}
          aria-busy="true"
        >
          <HarvestScreen progress={harvestProgress} error={harvestError} />
        </div>
      );
    }

    if (dashboardLayout.actionSlot === 'deltas') {
      return (
        <div
          className={`${timerBaseClass} dashboard-timer-card--action-status dashboard-timer-card--analysis`}
          aria-live="polite"
        >
          <PersonaDeltaSummary
            deltas={personaDeltas}
            scores={adjustedScores}
            dominantPersona={personaKey}
          />
        </div>
      );
    }

    if (dashboardLayout.actionSlot === 'generating') {
      return (
        <div
          className={`${timerBaseClass} dashboard-timer-card--action-status dashboard-timer-card--generating`}
          aria-busy="true"
        >
          <GeneratingContentLabel />
        </div>
      );
    }

    return (
      <button
        type="button"
        className={`${timerBaseClass}${idleTimerClass}`}
        style={idleTimerStyle}
        disabled={postGen.loading || !profile || !accountFeaturesEnabled}
        title={
          !accountFeaturesEnabled
            ? 'Open this profile from the Compliant app to generate updates'
            : undefined
        }
        onClick={() => {
          if (!accountFeaturesEnabled) return;
          triggerCountdownPulse();
          onGeneratePersonaPosts();
        }}
      >
        <span className="dashboard-update-timer" aria-label={`Next update in ${updateTimerLabel}`}>
          <span className="dashboard-update-label">Next update in</span>
          <span className="dashboard-update-time">{updateTimerLabel}</span>
        </span>
        {postGen.error ? (
          <span className="generate-posts-error" role="alert">
            {postGen.error}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div
      className={`dashboard-actions-row${
        hideBlockedActive || confirmActive || confirmUnhideActive
          ? ' dashboard-actions-row--confirm'
          : ''
      }`}
    >
      {renderTimerSlot()}
    </div>
  );
}
