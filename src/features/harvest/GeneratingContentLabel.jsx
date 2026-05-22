export function GeneratingEllipsis() {
  return (
    <span className="generating-ellipsis" aria-hidden="true">
      <span className="generating-ellipsis__dot">.</span>
      <span className="generating-ellipsis__dot">.</span>
      <span className="generating-ellipsis__dot">.</span>
    </span>
  );
}

export default function GeneratingContentLabel() {
  return (
    <div
      className="generating-content-block"
      role="status"
      aria-live="polite"
      aria-label="generating new content"
    >
      <p className="generating-content-label">
        generating new content
        <GeneratingEllipsis />
      </p>
    </div>
  );
}
