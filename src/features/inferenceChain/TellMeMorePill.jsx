/**
 * Dashboard "Tell me more" capsule.
 *
 * Collapsed: compact shimmer loading state. Expands when a feed post is highlighted.
 * Expanded: InferenceChainPanel for the highlighted post.
 */

import { useEffect, useState } from 'react';
import InferenceChainPanel from './InferenceChainPanel.jsx';
import TellMeMoreLoadingOverlay from './TellMeMoreLoadingOverlay.jsx';

const EXPANSION_LOADING_MS = 720;

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

export default function TellMeMorePill({
  highlightedPost,
  expanded,
  closing = false,
  fallbackPersona = 'security',
  personaAccent = null,
  personaPastel = null,
  holdLoadingOverlay = false,
  isAnalysisRedacted = false,
  onRedactedUnhideConfirm = null,
  skipExpansionLoading = false,
}) {
  const mainPersonaKey = String(fallbackPersona ?? 'security').toLowerCase();
  const postPersonaKey = String(highlightedPost?.persona ?? mainPersonaKey).toLowerCase();
  const postUiKey = PERSONA_ACCENT[postPersonaKey] ? postPersonaKey : mainPersonaKey;
  const postAccent =
    highlightedPost?.noteColor ?? PERSONA_ACCENT[postUiKey] ?? PERSONA_ACCENT.security;
  const postPastel = PERSONA_PASTEL[postUiKey] ?? PERSONA_PASTEL.security;
  const mainAccent =
    personaAccent ?? PERSONA_ACCENT[mainPersonaKey] ?? PERSONA_ACCENT.security;
  const mainPastel =
    personaPastel ?? PERSONA_PASTEL[mainPersonaKey] ?? PERSONA_PASTEL.security;
  const accent = highlightedPost ? postAccent : mainAccent;
  const pastel = highlightedPost ? postPastel : mainPastel;
  const label = PERSONA_LABEL[postPersonaKey] ?? 'Social';
  const mainLabel = PERSONA_LABEL[mainPersonaKey] ?? 'Security';
  const activePostKey =
    expanded && highlightedPost
      ? String(highlightedPost.id ?? highlightedPost.createdAt ?? highlightedPost.content ?? postPersonaKey)
      : null;
  const [loadedPostKey, setLoadedPostKey] = useState(skipExpansionLoading ? activePostKey : null);

  useEffect(() => {
    if (!activePostKey) {
      setLoadedPostKey(null);
      return undefined;
    }

    if (skipExpansionLoading) {
      setLoadedPostKey(activePostKey);
      return undefined;
    }

    setLoadedPostKey(null);
    const timer = setTimeout(() => {
      setLoadedPostKey(activePostKey);
    }, EXPANSION_LOADING_MS);
    return () => clearTimeout(timer);
  }, [activePostKey, skipExpansionLoading]);

  const pillStyle = {
    '--tell-pill-accent': accent,
    '--tell-pill-pastel': pastel,
    '--lb-acc': accent,
  };

  const expansionLoading =
    Boolean(activePostKey) && !skipExpansionLoading && !closing && loadedPostKey !== activePostKey;

  if (expanded && highlightedPost && expansionLoading) {
    return (
      <div
        className="tell-more-pill tell-more-pill--expanded tell-more-pill--expanding"
        style={pillStyle}
        role="region"
        aria-label="Loading tell me more analysis"
      >
        <div className="inference-panel inference-panel--expansion-loading is-ready">
          <TellMeMoreLoadingOverlay loadingKey={activePostKey} loop />
        </div>
      </div>
    );
  }

  if (expanded && highlightedPost) {
    return (
      <div
        className={`tell-more-pill tell-more-pill--expanded${closing ? ' tell-more-pill--closing' : ''}${isAnalysisRedacted ? ' tell-more-pill--redacted' : ''}`}
        style={pillStyle}
        role="region"
        aria-label="Inference chain analysis"
      >
        <InferenceChainPanel
          post={highlightedPost}
          personaLabel={label}
          holdLoadingOverlay={holdLoadingOverlay}
          redacted={isAnalysisRedacted}
          onRedactedUnhideConfirm={onRedactedUnhideConfirm}
        />
      </div>
    );
  }

  return (
    <div
      className="tell-more-pill tell-more-pill--idle"
      style={pillStyle}
      role="status"
      aria-live="polite"
      aria-label={`Tell me more - loading analysis for ${mainLabel} post`}
    >
      <div className="tell-idle-a">
        <div className="tell-idle-a__top">
          <span className="tell-idle-a__persona">{mainLabel} post</span>
          <span className="tell-idle-a__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="tell-idle-a__bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="tell-idle-a__cta">
          <span>Tell me why</span>
          <b aria-hidden="true">→</b>
        </div>
      </div>
    </div>
  );
}
