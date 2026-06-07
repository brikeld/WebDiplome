/**
 * Soft placeholder surface for redacted Tell-Me-More analysis.
 * Uses gradient meshes instead of filter:blur() on complex DOM, which tiles
 * into visible squares in Chrome/Safari.
 */
export default function RedactedAnalysisBackdrop({ leaderboard = false }) {
  return (
    <div
      className={`inference-panel__redacted-backdrop${leaderboard ? ' inference-panel__redacted-backdrop--leaderboard' : ''}`}
      aria-hidden="true"
    >
      {leaderboard ? (
        <>
          <span className="inference-panel__redacted-shape inference-panel__redacted-shape--lb-title" />
          <span className="inference-panel__redacted-shape inference-panel__redacted-shape--lb-row-a" />
          <span className="inference-panel__redacted-shape inference-panel__redacted-shape--lb-row-b" />
          <span className="inference-panel__redacted-shape inference-panel__redacted-shape--lb-row-c" />
          <span className="inference-panel__redacted-shape inference-panel__redacted-shape--lb-verdict" />
        </>
      ) : (
        <>
          <span className="inference-panel__redacted-shape inference-panel__redacted-shape--quote" />
          <span className="inference-panel__redacted-shape inference-panel__redacted-shape--tile-a" />
          <span className="inference-panel__redacted-shape inference-panel__redacted-shape--tile-b" />
          <span className="inference-panel__redacted-shape inference-panel__redacted-shape--tile-c" />
        </>
      )}
    </div>
  );
}
