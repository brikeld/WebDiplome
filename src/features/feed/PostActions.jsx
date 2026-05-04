export default function PostActions() {
  return (
    <button
      type="button"
      className="post-meta-pill post-action-btn post-action-btn--comment"
      aria-label="Comment"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5l-3.7 2.8A.6.6 0 0 1 5 17.4V15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      </svg>
    </button>
  );
}
