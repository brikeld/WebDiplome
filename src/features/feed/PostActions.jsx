export default function PostActions() {
  return (
    <>
      <button
        type="button"
        className="post-meta-circle post-action-btn"
        aria-label="Like"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M10 17.2c-.3 0-.6-.1-.8-.3C7.3 15.4 2 11.5 2 7.5 2 5 4 3 6.5 3c1.4 0 2.7.7 3.5 1.7C10.8 3.7 12.1 3 13.5 3 16 3 18 5 18 7.5c0 4-5.3 7.9-7.2 9.4-.2.2-.5.3-.8.3z" />
        </svg>
      </button>
      <button
        type="button"
        className="post-meta-circle post-action-btn"
        aria-label="Comment"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5l-3.7 2.8A.6.6 0 0 1 5 17.4V15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        </svg>
      </button>
    </>
  );
}
