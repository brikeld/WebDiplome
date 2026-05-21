import { forwardRef } from 'react';

const CommentsToggle = forwardRef(function CommentsToggle(
  { isOpen, onToggle, controlsId },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`post-meta-pill post-action-btn post-action-btn--outline commenting-toggle-host${isOpen ? ' commenting-toggle-host--open' : ''}`}
      aria-label={isOpen ? 'Close comments' : 'Open comments'}
      aria-expanded={isOpen}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      {isOpen ? (
        <svg
          viewBox="0 0 20 20"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          aria-hidden
        >
          <line x1="5" y1="5" x2="15" y2="15" />
          <line x1="15" y1="5" x2="5" y2="15" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5l-3.7 2.8A.6.6 0 0 1 5 17.4V15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        </svg>
      )}
    </button>
  );
});

export default CommentsToggle;
