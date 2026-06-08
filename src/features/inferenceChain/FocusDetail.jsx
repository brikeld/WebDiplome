import { isValidElement, useEffect, useMemo, useState } from 'react';

const CHAR_MS = 24;
const MIN_MS = 700;
const MAX_MS = 3600;

function extractText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    return node.map(extractText).filter(Boolean).join('');
  }
  if (!isValidElement(node)) return '';

  const inner = extractText(node.props.children);
  if (!inner) return '';

  if (node.type === 'li') return `\n• ${inner.trim()}`;
  if (node.type === 'p' || node.type === 'b') return `${inner.trim()}\n\n`;
  if (node.type === 'span' && typeof node.props?.className === 'string' && node.props.className.includes('tape__detail')) {
    return `\n\n${inner.trim()}`;
  }
  if (node.type === 'ul') return inner.trim();
  return inner;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return reduced;
}

function useTypewriter(text, detailKey) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const normalized = useMemo(() => text.replace(/\n{3,}/g, '\n\n').trim(), [text]);
  const [visibleCount, setVisibleCount] = useState(prefersReducedMotion ? normalized.length : 0);

  useEffect(() => {
    if (!detailKey || !normalized.length) {
      setVisibleCount(0);
      return undefined;
    }

    if (prefersReducedMotion) {
      setVisibleCount(normalized.length);
      return undefined;
    }

    setVisibleCount(0);
    const totalMs = Math.min(MAX_MS, Math.max(MIN_MS, normalized.length * CHAR_MS));
    const stepMs = totalMs / normalized.length;
    let count = 0;
    let rafId = 0;
    let lastTs = 0;

    const tick = (ts) => {
      if (!lastTs) lastTs = ts;
      const elapsed = ts - lastTs;
      if (elapsed >= stepMs) {
        const steps = Math.max(1, Math.floor(elapsed / stepMs));
        count = Math.min(normalized.length, count + steps);
        setVisibleCount(count);
        lastTs = ts;
        if (count >= normalized.length) return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [detailKey, normalized, prefersReducedMotion]);

  return {
    visibleText: normalized.slice(0, visibleCount),
    done: visibleCount >= normalized.length,
  };
}

export default function FocusDetail({ eyebrow, detailKey, onBack, children }) {
  const fullText = useMemo(() => extractText(children), [children]);
  const { visibleText, done } = useTypewriter(fullText, detailKey);

  return (
    <div className="focus-detail">
      <div className="focus-detail__head">
        {onBack ? (
          <div className="focus-detail__back-slot">
            <button
              type="button"
              className={`focus-detail__back${done ? ' focus-detail__back--concealed' : ''}`}
              onClick={onBack}
              aria-label="Back"
              aria-hidden={done}
              tabIndex={done ? -1 : 0}
            >
              ←
            </button>
          </div>
        ) : null}
        {eyebrow ? <span className="focus-detail__eyebrow">{eyebrow}</span> : null}
      </div>
      <div className="focus-detail__prose">
        <div
          className={`focus-detail__text${done ? '' : ' focus-detail__text--typing'}`}
          aria-live="polite"
        >
          {done ? (
            children
          ) : (
            <>
              {visibleText}
              <span className="focus-detail__caret" aria-hidden="true" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
