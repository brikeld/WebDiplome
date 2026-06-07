import { useCallback, useEffect, useRef, useState } from 'react';
import HarvestScreen from '@/features/harvest/HarvestScreen.jsx';
import PersonaDeltaSummary from '@/features/harvest/PersonaDeltaSummary.jsx';
import GeneratingContentLabel from '@/features/harvest/GeneratingContentLabel.jsx';
import { personaToUiKey, resolveHideContentPersona } from '@/lib/personaScoreCompliance.js';
import { personaUiColor } from '@/lib/personaColors.js';
import {
  formatRestorePointsLabel,
  unhideConfirmActionLabel,
  unhideConfirmCancelLabel,
  unhideConfirmTitle,
} from '@/lib/hideConfirmMessages.js';

/** Keep in sync with `post-reveal-flash` in harvest.css. */
const ACTION_FLASH_MS = 1100;

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
  manualGenerateEnabled = true,
  accountFeaturesEnabled = true,
  postRevealFlash = null,
}) {
  const hidePersonaUiKey =
    hidePersonaUiKeyProp ??
    (highlightedPost ? personaToUiKey(resolveHideContentPersona(highlightedPost)) : null);
  const hideBlockedActive = hideBlocked && highlightedPost && !highlightedPostIsHidden;
  const confirmActive = confirmingHide && highlightedPost && !highlightedPostIsHidden;
  const confirmUnhideActive = confirmingUnhide && highlightedPost && highlightedPostIsHidden;

  const CONFIRM_EXIT_MS = 420;
  const [confirmClosing, setConfirmClosing] = useState(null);
  const [timerReveal, setTimerReveal] = useState(false);
  const confirmCloseTimerRef = useRef(null);
  const timerRevealTimerRef = useRef(null);

  const hideBlockedVisible = hideBlockedActive || confirmClosing === 'blocked';
  const confirmHideVisible = confirmActive || confirmClosing === 'hide';
  const confirmUnhideVisible = confirmUnhideActive || confirmClosing === 'unhide';

  const dismissConfirm = useCallback(
    (kind, onDone) => {
      if (confirmClosing) return;
      setConfirmClosing(kind);
      if (confirmCloseTimerRef.current) clearTimeout(confirmCloseTimerRef.current);
      confirmCloseTimerRef.current = setTimeout(() => {
        confirmCloseTimerRef.current = null;
        setConfirmClosing(null);
        onDone?.();
        setTimerReveal(true);
        if (timerRevealTimerRef.current) clearTimeout(timerRevealTimerRef.current);
        timerRevealTimerRef.current = setTimeout(() => {
          setTimerReveal(false);
          timerRevealTimerRef.current = null;
        }, CONFIRM_EXIT_MS);
      }, CONFIRM_EXIT_MS);
    },
    [confirmClosing],
  );

  useEffect(
    () => () => {
      if (confirmCloseTimerRef.current) clearTimeout(confirmCloseTimerRef.current);
      if (timerRevealTimerRef.current) clearTimeout(timerRevealTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (hideBlockedActive || confirmActive || confirmUnhideActive) {
      setConfirmClosing(null);
      setTimerReveal(false);
    }
  }, [hideBlockedActive, confirmActive, confirmUnhideActive]);

  const confirmCardClass = (kind) =>
    confirmClosing === kind ? ' dashboard-timer-card--confirm-closing' : '';
  const idleTimerActive = dashboardLayout.actionSlot === 'timer';
  const points = Math.abs(Number(highlightedPost?.systemDeltaPct) || 1);
  const restorePointsLabel = formatRestorePointsLabel(highlightedPost?.systemDeltaPct);
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
  const [secondPulseOn, setSecondPulseOn] = useState(false);
  const prevRemainingMsRef = useRef(updateRemainingMs);
  const prevSecondRef = useRef(null);
  const pulseEndTimerRef = useRef(null);
  const secondPulseTimerRef = useRef(null);

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
      if (secondPulseTimerRef.current) clearTimeout(secondPulseTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!idleTimerActive) {
      setCountdownPulseOn(false);
      setSecondPulseOn(false);
      prevSecondRef.current = null;
      return;
    }
    const prev = prevRemainingMsRef.current;
    prevRemainingMsRef.current = updateRemainingMs;
    const crossedZero = prev > 1000 && updateRemainingMs <= 1000;
    if (crossedZero) {
      triggerCountdownPulse();
    }

    const seconds = Math.max(0, Math.ceil(updateRemainingMs / 1000));
    if (prevSecondRef.current !== null && prevSecondRef.current !== seconds) {
      setSecondPulseOn(true);
      if (secondPulseTimerRef.current) clearTimeout(secondPulseTimerRef.current);
      secondPulseTimerRef.current = setTimeout(() => {
        setSecondPulseOn(false);
        secondPulseTimerRef.current = null;
      }, 480);
    }
    prevSecondRef.current = seconds;
  }, [updateRemainingMs, idleTimerActive, triggerCountdownPulse]);

  const idleTimerClass = idleTimerActive
    ? ` dashboard-timer-card--idle-countdown${
        countdownPulseOn ? ' dashboard-timer-card--countdown-pulse' : ''
      }`
    : '';
  const idleTimerStyle = { '--persona-accent': personaColor };

  // Latch the per-reveal accent flash so it can also play on the idle timer
  // button — the generating screen is dismissed after the first post, so
  // posts 2+ land while this button is showing. Mirrors the feed-top flash.
  const flashNonce = postRevealFlash?.nonce ?? 0;
  const [actionFlash, setActionFlash] = useState(null);
  const actionFlashTimerRef = useRef(null);
  useEffect(() => {
    if (!flashNonce) return undefined;
    setActionFlash({ nonce: flashNonce, color: personaUiColor(postRevealFlash?.persona) });
    if (actionFlashTimerRef.current) clearTimeout(actionFlashTimerRef.current);
    actionFlashTimerRef.current = setTimeout(() => {
      setActionFlash(null);
      actionFlashTimerRef.current = null;
    }, ACTION_FLASH_MS);
    return undefined;
    // Retrigger only on nonce changes; persona is read fresh each bump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashNonce]);
  useEffect(
    () => () => {
      if (actionFlashTimerRef.current) clearTimeout(actionFlashTimerRef.current);
    },
    [],
  );

  const renderTimerSlot = () => {
    if (hideBlockedVisible) {
      const blockedLabel = (
        personaLabels[hidePersonaUiKey] ?? highlightedPostPersonaLabel ?? 'Social'
      ).toLowerCase();
      return (
        <div
          className={`${timerBaseClass} dashboard-timer-card--confirm dashboard-timer-card--confirm-blocked${confirmCardClass('blocked')}`}
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
                onClick={() => dismissConfirm('blocked', onCancelHide)}
                disabled={confirmClosing === 'blocked'}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (confirmUnhideVisible) {
      return (
        <div
          className={`${timerBaseClass} dashboard-timer-card--confirm dashboard-timer-card--confirm-unhide${confirmCardClass('unhide')}`}
          role="alertdialog"
          aria-labelledby="unhide-confirm-title-inline"
          style={timerStyle}
        >
          <div className="dashboard-hide-confirm__body">
            <h3 id="unhide-confirm-title-inline" className="dashboard-hide-confirm__title">
              {unhideConfirmTitle(leaderboardSelected)}
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
                onClick={() => dismissConfirm('unhide', onCancelHide)}
                disabled={confirmClosing === 'unhide'}
              >
                {unhideConfirmCancelLabel(leaderboardSelected)}
              </button>
              <button
                type="button"
                className="dashboard-hide-confirm__btn dashboard-hide-confirm__btn--hide"
                onClick={onConfirmUnhide}
              >
                {unhideConfirmActionLabel(leaderboardSelected)}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (confirmHideVisible) {
      return (
        <div
          className={`${timerBaseClass} dashboard-timer-card--confirm dashboard-timer-card--confirm-hide${leaderboardSelected ? ' dashboard-timer-card--confirm-ranking' : ' dashboard-timer-card--confirm-post'}${confirmCardClass('hide')}`}
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
                onClick={() => dismissConfirm('hide', onCancelHide)}
                disabled={confirmClosing === 'hide'}
              >
                {leaderboardSelected ? 'Stay visible' : 'Keep post'}
              </button>
              <button
                type="button"
                className="dashboard-hide-confirm__btn dashboard-hide-confirm__btn--hide"
                data-hide-confirm-action="hide"
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
          <GeneratingContentLabel revealFlash={postRevealFlash} />
        </div>
      );
    }

    return (
      <button
        type="button"
        className={`${timerBaseClass}${idleTimerClass}${
          timerReveal ? ' dashboard-timer-card--reveal' : ''
        }`}
        style={idleTimerStyle}
        disabled={postGen.loading || !profile || !accountFeaturesEnabled || !manualGenerateEnabled}
        title={
          !accountFeaturesEnabled
            ? 'Open this profile from the Compliant app to generate updates'
            : !manualGenerateEnabled
              ? 'Keep this page open and wait for the timer to generate updates'
            : undefined
        }
        onClick={() => {
          if (!accountFeaturesEnabled || !manualGenerateEnabled) return;
          triggerCountdownPulse();
          onGeneratePersonaPosts();
        }}
      >
        {actionFlash ? (
          <span
            key={actionFlash.nonce}
            className="dashboard-timer-card__post-flash"
            style={{ '--flash-color': actionFlash.color }}
            aria-hidden
          />
        ) : null}
        <span className="dashboard-update-timer" aria-label={`Next update in ${updateTimerLabel}`}>
          <span className="dashboard-update-label">Next update in</span>
          <span
            className={`dashboard-update-time${
              secondPulseOn ? ' dashboard-update-time--second-pulse' : ''
            }`}
          >
            {updateTimerLabel}
          </span>
        </span>
        {postGen.error ? (
          <span className="generate-posts-error" role="alert">
            {postGen.error}
          </span>
        ) : null}
      </button>
    );
  };

  const actionsRowConfirm =
    hideBlockedVisible || confirmHideVisible || confirmUnhideVisible || timerReveal;

  return (
    <div
      className={`dashboard-actions-row${
        actionsRowConfirm ? ' dashboard-actions-row--confirm' : ''
      }${confirmClosing ? ' dashboard-actions-row--confirm-leaving' : ''}`}
    >
      {renderTimerSlot()}
    </div>
  );
}
