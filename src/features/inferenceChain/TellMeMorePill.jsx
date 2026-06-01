/**
 * Dashboard "Tell me more" capsule.
 *
 * Collapsed: compact shimmer (always loading) — select a post in the feed to expand.
 * Expanded: InferenceChainPanel for the highlighted post.
 */

import InferenceChainPanel from './InferenceChainPanel.jsx';
import TellMeMoreLoadingOverlay from './TellMeMoreLoadingOverlay.jsx';

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

  const pillStyle = {
    '--tell-pill-accent': accent,
    '--tell-pill-pastel': pastel,
    '--lb-acc': accent,
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

  return (
    <div
      className="tell-more-pill tell-more-pill--idle"
      style={pillStyle}
      role="status"
      aria-live="polite"
      aria-label="Tell me more — select a post in the feed"
    >
      <TellMeMoreLoadingOverlay loop compact />
    </div>
  );
}
