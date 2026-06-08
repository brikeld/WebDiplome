/**
 * Dashboard "Tell me more" capsule.
 *
 * tell-morph shell (both-states prototype): idle layer, analysis loader, panel layer.
 * Capsule phase classes (is-tell-loading, is-tell-content-ready, …) drive crossfades.
 */

import InferenceChainPanel from './InferenceChainPanel.jsx';
import TellAnalysisLoader from './TellAnalysisLoader.jsx';

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
  tellPhase = 'idle',
  highlightedPost,
  expanded,
  closing = false,
  fallbackPersona = 'security',
  personaAccent = null,
  personaPastel = null,
  holdLoadingOverlay = false,
  isAnalysisRedacted = false,
  onRedactedUnhideConfirm = null,
}) {
  const mainPersonaKey = String(fallbackPersona ?? 'security').toLowerCase();
  const postPersonaKey = String(highlightedPost?.persona ?? mainPersonaKey).toLowerCase();
  const postUiKey = PERSONA_ACCENT[postPersonaKey] ? postPersonaKey : mainPersonaKey;
  const mainAccent =
    personaAccent ?? PERSONA_ACCENT[mainPersonaKey] ?? PERSONA_ACCENT.security;
  const mainPastel =
    personaPastel ?? PERSONA_PASTEL[mainPersonaKey] ?? PERSONA_PASTEL.security;
  const postAccent =
    highlightedPost?.noteColor ?? PERSONA_ACCENT[postUiKey] ?? PERSONA_ACCENT.security;
  const postPastel = PERSONA_PASTEL[postUiKey] ?? PERSONA_PASTEL.security;
  // Keep idle white/chrome locked until layout expand finishes — then swap to post theme.
  const lockIdleTheme =
    tellPhase === 'idle' ||
    tellPhase === 'expanding' ||
    (tellPhase === 'closing' && !expanded);
  const accent = lockIdleTheme ? mainAccent : postAccent;
  const pastel = lockIdleTheme ? mainPastel : postPastel;
  const label = PERSONA_LABEL[postUiKey] ?? 'Social';
  const mainLabel = PERSONA_LABEL[mainPersonaKey] ?? 'Security';
  const displayLabel = lockIdleTheme ? mainLabel : label;
  const skipPanelLoader = Boolean(highlightedPost && !highlightedPost.leaderboard);

  const pillStyle = {
    '--tell-pill-accent': accent,
    '--tell-pill-pastel': pastel,
    '--lb-acc': accent,
  };

  return (
    <div className="tell-morph" style={pillStyle}>
      <button
        type="button"
        className="tell-more-pill tell-more-pill--idle tell-morph__idle"
        aria-disabled="true"
        aria-live="polite"
        tabIndex={-1}
        aria-label={`Tell me more - ${displayLabel} post`}
      >
        <div className="tell-idle-a">
          <div className="tell-idle-a__top">
            <span className="tell-idle-a__persona">{displayLabel} post</span>
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
      </button>

      <TellAnalysisLoader />

      <div
        className={`tell-morph__panel tell-more-pill tell-more-pill--expanded${closing ? ' tell-more-pill--closing' : ''}${isAnalysisRedacted ? ' tell-more-pill--redacted' : ''}`}
        role="region"
        aria-label="Inference chain analysis"
        data-tell-phase={tellPhase}
      >
        {expanded && highlightedPost ? (
          <InferenceChainPanel
            post={highlightedPost}
            personaLabel={label}
            holdLoadingOverlay={holdLoadingOverlay}
            skipLoadingOverlay={skipPanelLoader}
            redacted={isAnalysisRedacted}
            onRedactedUnhideConfirm={onRedactedUnhideConfirm}
          />
        ) : null}
      </div>
    </div>
  );
}
