import {
  formatRestorePointsLabel,
  unhideConfirmActionLabel,
  unhideConfirmCancelLabel,
  unhideConfirmTitle,
} from '@/lib/hideConfirmMessages.js';

function UnhideMessage({ leaderboard, restorePointsLabel, personaLabelLower }) {
  if (leaderboard) {
    return (
      <>
        Showing your position again will restore{' '}
        <span className="inference-panel__redacted-chip">+{restorePointsLabel}%</span> on your{' '}
        {personaLabelLower} score and put your position back on this leaderboard.
      </>
    );
  }

  return (
    <>
      If you unhide this post, you will regain{' '}
      <span className="inference-panel__redacted-chip">+{restorePointsLabel}%</span> on your{' '}
      {personaLabelLower} score and everyone will be able to see this post again.
    </>
  );
}

export default function RedactedAnalysisOverlay({
  leaderboard = false,
  post = null,
  personaLabel = 'Social',
  onUnhideConfirm = null,
}) {
  const personaLabelLower = String(personaLabel ?? 'Social').toLowerCase();
  const restorePointsLabel = formatRestorePointsLabel(post?.systemDeltaPct);
  const showUnhide = typeof onUnhideConfirm === 'function';

  return (
    <div className="inference-panel__redacted-stack" aria-live="polite">
      <div className="inference-panel__redacted-notice">
        <span className="inference-panel__redacted-notice-title">
          {leaderboard
            ? 'Hidden ranking analysis remains blurred'
            : 'Hidden post analysis remains blurred'}
        </span>
        <p>
          {leaderboard
            ? 'Reveal the ranking to inspect the analysis.'
            : 'Unhide the post to inspect it.'}
        </p>
      </div>

      {showUnhide ? (
        <div
          className="inference-panel__redacted-notice inference-panel__redacted-notice--unhide"
          role="group"
          aria-label={unhideConfirmTitle(leaderboard)}
        >
          <span className="inference-panel__redacted-notice-title">{unhideConfirmTitle(leaderboard)}</span>
          <p>
            <UnhideMessage
              leaderboard={leaderboard}
              restorePointsLabel={restorePointsLabel}
              personaLabelLower={personaLabelLower}
            />
          </p>
          <div className="inference-panel__redacted-unhide-actions">
            <button
              type="button"
              className="inference-panel__redacted-unhide-btn inference-panel__redacted-unhide-btn--cancel"
            >
              {unhideConfirmCancelLabel(leaderboard)}
            </button>
            <button
              type="button"
              className="inference-panel__redacted-unhide-btn inference-panel__redacted-unhide-btn--confirm"
              onClick={(e) => {
                e.stopPropagation();
                onUnhideConfirm();
              }}
            >
              {unhideConfirmActionLabel(leaderboard)}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
