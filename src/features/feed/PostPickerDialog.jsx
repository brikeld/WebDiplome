import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './postPickerDialog.css';

export default function PostPickerDialog({ mode, selectedPost, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const isHide = mode === 'hide';
  const hasPost = Boolean(selectedPost);

  return createPortal(
    <div className="post-picker-backdrop" role="presentation">
      <div
        className={`post-picker-dialog${hasPost ? ' post-picker-dialog--ready' : ''}`}
        role="dialog"
        aria-labelledby="post-picker-title"
      >
        <p className="post-picker-kicker">{isHide ? 'hide post' : 'tell me more'}</p>
        <h2 id="post-picker-title" className="post-picker-title">
          {hasPost ? 'Post selected' : 'Select a post'}
        </h2>
        <p className="post-picker-body">
          {hasPost
            ? 'Ready to proceed. Confirm below.'
            : 'Click anywhere on a post in the feed to highlight it.'}
        </p>
        <div className="post-picker-actions">
          <button
            ref={cancelRef}
            type="button"
            className="post-picker-btn post-picker-btn--cancel"
            onClick={() => onCancel?.()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="post-picker-btn post-picker-btn--confirm"
            disabled={!hasPost}
            onClick={() => hasPost && onConfirm?.()}
          >
            {isHide ? 'Hide it' : 'Show me'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
