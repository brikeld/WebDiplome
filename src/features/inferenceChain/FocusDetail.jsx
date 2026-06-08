import { cloneElement, isValidElement, useEffect, useMemo, useState } from 'react';

const CHAR_MS = 24;
const MIN_MS = 700;
const MAX_MS = 3600;

function extractText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  if (!isValidElement(node)) return '';

  const inner = extractText(node.props.children);
  if (!inner) return '';

  if (node.type === 'li') return `\n• ${inner.trim()}`;
  return inner;
}

function revealChildren(node, maxChars) {
  let remaining = maxChars;

  function walk(current) {
    if (remaining <= 0) return null;
    if (current == null || typeof current === 'boolean') return null;

    if (typeof current === 'string' || typeof current === 'number') {
      const str = String(current);
      if (!str) return null;
      const take = str.slice(0, remaining);
      remaining -= take.length;
      return take || null;
    }

    if (Array.isArray(current)) {
      const parts = [];
      for (const item of current) {
        const part = walk(item);
        if (part == null) continue;
        if (Array.isArray(part)) parts.push(...part);
        else parts.push(part);
        if (remaining <= 0) break;
      }
      return parts.length ? parts : null;
    }

    if (!isValidElement(current)) return null;

    const inner = walk(current.props.children);
    if (inner == null) return null;

    return cloneElement(current, { key: current.key }, inner);
  }

  return walk(node);
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
    visibleCount,
    done: visibleCount >= normalized.length,
  };
}

export default function FocusDetail({ eyebrow, detailKey, onBack, children }) {
  const fullText = useMemo(() => extractText(children), [children]);
  const { visibleCount, done } = useTypewriter(fullText, detailKey);
  const revealed = useMemo(
    () => revealChildren(children, visibleCount),
    [children, visibleCount],
  );

  return (
    <div className="focus-detail">
      <div className="focus-detail__head">
        {onBack ? (
          <div className="focus-detail__back-slot">
            <button type="button" className="focus-detail__back" onClick={onBack} aria-label="Back">
              ←
            </button>
          </div>
        ) : null}
        {eyebrow ? <span className="focus-detail__eyebrow">{eyebrow}</span> : null}
      </div>
      <div className="focus-detail__prose">
        <div className="focus-detail__text" aria-live="polite">
          {revealed}
          {!done ? <span className="focus-detail__caret" aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
  );
}
