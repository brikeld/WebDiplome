/**
 * Dashboard "Tell me more" pill — expansion + nudge state machine.
 *
 * States (set via className):
 *   - normal       : no post highlighted, muted icon, pastel fill
 *   - armed        : a post is highlighted, glow pulse + crisp icon
 *   - nudge        : user clicked with no selection — wiggle + "Select a post first"
 *   - expanded     : panel takes over; renders InferenceChainPanel
 *
 * Shape & animations use the shared dashboard capsule pill language
 * (see inferenceChain.css).
 */

import { useEffect, useState } from 'react';
import InferenceChainPanel from './InferenceChainPanel.jsx';

const PERSONA_PASTEL = {
  productivity: '#EEEEEE',
  productivite: '#EEEEEE',
  security: '#BCCDF5',
  securite: '#BCCDF5',
  popularity: '#EBF8B7',
  popularite: '#EBF8B7',
  social: '#EBF8B7',
};

const PERSONA_ACCENT = {
  productivity: '#D8D8D8',
  productivite: '#D8D8D8',
  security: '#759AEF',
  securite: '#759AEF',
  popularity: '#CCF847',
  popularite: '#CCF847',
  social: '#CCF847',
};

const PERSONA_LABEL = {
  productivity: 'Productivity',
  productivite: 'Productivity',
  security: 'Security',
  securite: 'Security',
  popularity: 'Social',
  popularite: 'Social',
  social: 'Social',
};

function GhostPostBg() {
  return (
    <div className="tell-more-pill__bg-post" aria-hidden>
      <div className="tell-more-pill__avatar" />
      <div className="tell-more-pill__lines">
        <div className="tell-more-pill__line" />
        <div className="tell-more-pill__line tell-more-pill__line--short" />
        <div className="tell-more-pill__line tell-more-pill__line--tiny" />
      </div>
    </div>
  );
}

function MagnifierIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
      <path d="M7 9h5v1H7zM7 11h3.5v1H7z" />
    </svg>
  );
}

function CursorIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M4 2v16.4l4.2-3.9 2.4 5.5 2.5-1.1-2.4-5.5H16L4 2z" />
    </svg>
  );
}

export default function TellMeMorePill({
  highlightedPost,
  selectionPulseFlip = false,
  expanded,
  closing = false,
  onExpand,
  disabled = false,
  fallbackPersona = 'security',
}) {
  const [nudging, setNudging] = useState(false);

  useEffect(() => {
    if (!nudging) return undefined;
    const id = setTimeout(() => setNudging(false), 4000);
    return () => clearTimeout(id);
  }, [nudging]);

  // Dismiss the nudge as soon as the user selects a post.
  useEffect(() => {
    if (highlightedPost) setNudging(false);
  }, [highlightedPost]);

  const mainPersonaKey = String(fallbackPersona ?? 'security').toLowerCase();
  const postPersonaKey = String(highlightedPost?.persona ?? mainPersonaKey).toLowerCase();
  const postUiKey = PERSONA_ACCENT[postPersonaKey] ? postPersonaKey : mainPersonaKey;
  const postAccent =
    highlightedPost?.noteColor ?? PERSONA_ACCENT[postUiKey] ?? PERSONA_ACCENT.security;
  const postPastel = PERSONA_PASTEL[postUiKey] ?? PERSONA_PASTEL.security;
  const accent = highlightedPost
    ? postAccent
    : PERSONA_ACCENT[mainPersonaKey] ?? PERSONA_ACCENT.security;
  const pastel = highlightedPost
    ? postPastel
    : PERSONA_PASTEL[mainPersonaKey] ?? PERSONA_PASTEL.security;
  const label = PERSONA_LABEL[postPersonaKey] ?? 'Social';

  const pillStyle = {
    '--tell-pill-accent': accent,
    '--tell-pill-pastel': pastel,
  };

  if (expanded && highlightedPost) {
    return (
      <div
        className={`tell-more-pill tell-more-pill--expanded${closing ? ' tell-more-pill--closing' : ''}`}
        style={pillStyle}
        role="region"
        aria-label="Inference chain analysis"
      >
        <InferenceChainPanel
          post={highlightedPost}
          personaLabel={label}
        />
      </div>
    );
  }

  let stateModifier = 'tell-more-pill--normal';
  if (nudging) stateModifier = 'tell-more-pill--nudge';
  else if (highlightedPost) stateModifier = 'tell-more-pill--armed';
  const selectionPulseClass = highlightedPost
    ? ` tell-more-pill--select-pulse-${selectionPulseFlip ? 'b' : 'a'}`
    : '';

  const handleClick = () => {
    if (disabled) return;
    if (!highlightedPost) {
      setNudging(true);
      return;
    }
    setNudging(false);
    onExpand?.();
  };

  return (
    <button
      type="button"
      className={`tell-more-pill ${stateModifier}${selectionPulseClass}`}
      style={pillStyle}
      onClick={handleClick}
      disabled={disabled}
      aria-expanded={false}
      aria-label={
        highlightedPost
          ? 'Tell me more about this post'
          : 'Tell me more — select a post first'
      }
    >
      {nudging ? <GhostPostBg /> : null}
      <span className="tell-more-pill__icon">
        {nudging ? (
          <CursorIcon width="56" height="56" />
        ) : (
          <MagnifierIcon width="56" height="56" />
        )}
      </span>
      {nudging ? (
        <span className="tell-more-pill__nudge-capsule">Select a post first</span>
      ) : null}
    </button>
  );
}
