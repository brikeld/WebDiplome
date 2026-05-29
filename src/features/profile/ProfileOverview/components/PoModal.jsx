import { useEffect } from 'react';
import { personaUiColor } from '@/lib/personaColors.js';

export default function PoModal({ open, title, eyebrow, persona = 'productivity', onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="po-modal-backdrop" onClick={onClose}>
      <div
        className="po-modal"
        style={{ '--po-accent': personaUiColor(persona) }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="po-modal-head">
          <span className="po-card-headings">
            {eyebrow ? <span className="po-card-eyebrow">{eyebrow}</span> : null}
            <span className="po-card-title">{title}</span>
          </span>
          <button type="button" className="po-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="po-modal-body">{children}</div>
      </div>
    </div>
  );
}
