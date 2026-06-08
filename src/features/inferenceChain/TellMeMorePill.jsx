/**
 * Dashboard "Tell me more" — 4 steps rendered one at a time:
 * idle / expanding → loading (radar) → content (info)
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

function IdleFace({ displayLabel }) {
  return (
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
  );
}

export default function TellMeMorePill({
  tellPhase = 'idle',
  highlightedPost,
  /** @deprecated tests only — same as tellPhase="content" */
  expanded = false,
  fallbackPersona = 'security',
  personaAccent = null,
  personaPastel = null,
  holdLoadingOverlay = false,
  isAnalysisRedacted = false,
  onRedactedUnhideConfirm = null,
}) {
  const phase = expanded && tellPhase === 'idle' ? 'content' : tellPhase;
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
  const useMainTheme = phase === 'idle' || phase === 'expanding';
  const accent = useMainTheme ? mainAccent : postAccent;
  const pastel = useMainTheme ? mainPastel : postPastel;
  const label = PERSONA_LABEL[postUiKey] ?? 'Social';
  const mainLabel = PERSONA_LABEL[mainPersonaKey] ?? 'Security';
  const displayLabel = useMainTheme ? mainLabel : label;

  const pillStyle = {
    '--tell-pill-accent': accent,
    '--tell-pill-pastel': pastel,
    '--lb-acc': accent,
  };

  if (phase === 'loading') {
    return (
      <div className="tell-morph tell-morph--radar" style={pillStyle}>
        <TellAnalysisLoader />
      </div>
    );
  }

  if ((phase === 'content' || phase === 'closing') && highlightedPost) {
    return (
      <div
        className={`tell-morph tell-morph--info${phase === 'closing' ? ' tell-morph--closing' : ''}`}
        style={pillStyle}
      >
        <div
          className={`tell-more-pill tell-more-pill--expanded${isAnalysisRedacted ? ' tell-more-pill--redacted' : ''}`}
          role="region"
          aria-label="Inference chain analysis"
        >
          <InferenceChainPanel
            post={highlightedPost}
            personaLabel={label}
            holdLoadingOverlay={holdLoadingOverlay}
            skipLoadingOverlay={!highlightedPost.leaderboard}
            redacted={isAnalysisRedacted}
            onRedactedUnhideConfirm={onRedactedUnhideConfirm}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tell-morph tell-morph--idle" style={pillStyle}>
      <div className="tell-more-pill tell-more-pill--idle" aria-label={`Tell me more - ${displayLabel} post`}>
        <IdleFace displayLabel={displayLabel} />
      </div>
    </div>
  );
}
