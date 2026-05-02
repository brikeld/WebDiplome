import { useRef, useState, useCallback, useEffect } from 'react';
import PostCard from './PostCard.jsx';

const SNAP_THRESHOLD = 0.50;
const RESISTANCE = 2.5;
const SEGMENT_THRESHOLDS = [0.08, 0.20, 0.34, 0.50, 0.68, 0.85];

function splitThinking(text) {
  if (!text) return ['...', '', '', '', '', ''];
  const sentences = text.match(/[^.!?…]+[.!?…]*/g) ?? [text];
  const chunks = [];
  const perChunk = Math.ceil(sentences.length / 6);
  for (let i = 0; i < sentences.length; i += perChunk) {
    chunks.push(sentences.slice(i, i + perChunk).join(' ').trim());
  }
  while (chunks.length < 6) chunks.push('');
  return chunks.slice(0, 6);
}

export default function DraggablePostCard({ post }) {
  const wrapperRef = useRef(null);
  const cardRef = useRef(null);
  const dragState = useRef({ active: false, startX: 0, currentOffset: 0 });
  const animFrameRef = useRef(null);

  const [snapState, setSnapState] = useState('idle');
  const [dragOffset, setDragOffset] = useState(0);
  const [visibleSegments, setVisibleSegments] = useState(0);

  const isOpen = snapState === 'open';
  const segments = splitThinking(post.thinking ?? '');

  const getCardWidth = useCallback(() => {
    return wrapperRef.current?.offsetWidth ?? 400;
  }, []);

  const applyOffset = useCallback((rawDx) => {
    const cardWidth = getCardWidth();
    const clamped = Math.max(0, rawDx);
    const offset = clamped * (1 - clamped / (cardWidth * RESISTANCE));
    const bounded = Math.max(0, Math.min(offset, cardWidth));
    const dragPct = bounded / cardWidth;

    dragState.current.currentOffset = bounded;

    const visible = SEGMENT_THRESHOLDS.filter(t => dragPct >= t).length;

    setDragOffset(bounded);
    setVisibleSegments(visible);
  }, [getCardWidth]);

  const snapOpen = useCallback(() => {
    const cardWidth = getCardWidth();
    setSnapState('snapping');
    setDragOffset(cardWidth);
    setVisibleSegments(6);
    setTimeout(() => setSnapState('open'), 450);
  }, [getCardWidth]);

  const snapBack = useCallback(() => {
    setSnapState('snapping-back');
    setDragOffset(0);
    setVisibleSegments(0);
    setTimeout(() => setSnapState('idle'), 320);
  }, []);

  const onPointerDown = useCallback((e) => {
    if (isOpen) return;
    if (e.button !== undefined && e.button !== 0) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    dragState.current = { active: true, startX: clientX, currentOffset: 0 };
    setSnapState('idle');
    if (e.pointerId != null) cardRef.current?.setPointerCapture?.(e.pointerId);
  }, [isOpen]);

  const onPointerMove = useCallback((e) => {
    if (!dragState.current.active) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const rawDx = clientX - dragState.current.startX;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => applyOffset(rawDx));
  }, [applyOffset]);

  const onPointerUp = useCallback(() => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const cardWidth = getCardWidth();
    const pct = dragState.current.currentOffset / cardWidth;
    if (pct >= SNAP_THRESHOLD) {
      snapOpen();
    } else {
      snapBack();
    }
  }, [getCardWidth, snapOpen, snapBack]);

  const onThinkingClick = useCallback(() => {
    if (isOpen) snapBack();
  }, [isOpen, snapBack]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const isDragging = dragState.current.active;
  const cardClassName = [
    'post-reveal-card',
    isDragging ? 'is-dragging' : '',
    snapState === 'snapping' ? 'is-snapping' : '',
    snapState === 'snapping-back' ? 'is-snapping-back' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={wrapperRef} className="post-reveal-wrapper">
      <div
        className={`thinking-layer${isOpen ? ' is-open' : ''}`}
        onClick={onThinkingClick}
        aria-hidden={!isOpen}
      >
        <div className="thinking-layer-inner">
          {segments.map((seg, i) => (
            <span
              key={i}
              className={`thinking-segment${i < visibleSegments ? ' is-visible' : ''}`}
            >
              {seg}
            </span>
          ))}
        </div>
        {isOpen && <span className="thinking-close-hint">← swipe to close</span>}
      </div>

      <div
        ref={cardRef}
        className={cardClassName}
        style={{ transform: `translateX(${dragOffset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <PostCard post={post} />
      </div>
    </div>
  );
}
