import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './hidePostConfirm.css';

const PERSONA_COLORS = {
  productivite: '#D8D8D8',
  productivity: '#D8D8D8',
  securite: '#759AEF',
  security: '#759AEF',
  popularite: '#CCF847',
  popularity: '#CCF847',
  social: '#CCF847',
};

function personaLabel(persona) {
  const k = String(persona ?? '').toLowerCase();
  if (k === 'popularite' || k === 'popularity' || k === 'social') return 'Social';
  if (k === 'securite' || k === 'security') return 'Security';
  if (k === 'productivite' || k === 'productivity') return 'Productivity';
  return 'Social';
}

export default function HidePostConfirmDialog({ post, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  const persona = String(post?.persona ?? '').toLowerCase();
  const accent = PERSONA_COLORS[persona] ?? '#759AEF';
  const label = personaLabel(persona);
  const points = Math.abs(Number(post?.systemDeltaPct) || 1);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  return createPortal(
    <div
      className="hide-confirm-backdrop"
      role="presentation"
      style={{ '--hide-confirm-accent': accent }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div
        className="hide-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hide-confirm-title"
        aria-describedby="hide-confirm-desc"
        style={{ '--hide-confirm-accent': accent }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="hide-confirm-kicker">{label} persona</p>
        <h2 id="hide-confirm-title" className="hide-confirm-title">
          Hide this post?
        </h2>
        <p id="hide-confirm-desc" className="hide-confirm-body">
          If you hide it, you will lose{' '}
          <span className="hide-confirm-points">−{points}</span> on your{' '}
          <strong>{label}</strong> score. You can reveal it later to recover half.
        </p>
        <div className="hide-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="hide-confirm-btn hide-confirm-btn--cancel"
            onClick={() => onCancel?.()}
          >
            Keep post
          </button>
          <button
            type="button"
            className="hide-confirm-btn hide-confirm-btn--confirm"
            onClick={() => onConfirm?.()}
          >
            Hide anyway
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
