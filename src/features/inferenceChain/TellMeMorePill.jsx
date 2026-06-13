/**
 * Dashboard "Tell me more" — layered crossfades between idle, radar, and content.
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
  isAnalysisRedacted = false,
  onRedactedUnhideConfirm = null,
  onOpenProfile = null,
  authorSlug = null,
  leaderboardDirectorySlugs = [],
}) {
  const phase = expanded && tellPhase === 'idle' ? 'content' : tellPhase;
  const isLeaderboardPost = Boolean(highlightedPost?.leaderboard);
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

  const idleActive = phase === 'idle' || phase === 'expanding';
  const idleExit = phase === 'loading' || (isLeaderboardPost && phase === 'revealing');
  const showIdle = idleActive || idleExit;

  const loaderActive = !isLeaderboardPost && phase === 'loading';
  const loaderExit = !isLeaderboardPost && phase === 'revealing';
  const showLoader = loaderActive || loaderExit;

  const panelEnter = phase === 'revealing';
  const panelActive = phase === 'content' || phase === 'closing';
  const showPanel = Boolean(highlightedPost && (panelEnter || panelActive));

  const pillStyle = {
    '--tell-pill-accent': accent,
    '--tell-pill-pastel': pastel,
    '--lb-acc': accent,
  };

  const morphClass = [
    'tell-morph',
    !isLeaderboardPost && (phase === 'loading' || phase === 'revealing') ? 'tell-morph--radar-phase' : '',
    phase === 'content' || phase === 'revealing' || phase === 'closing' ? 'tell-morph--info-phase' : '',
    phase === 'closing' ? 'tell-morph--closing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={morphClass} style={pillStyle} data-tell-phase={phase}>
      {showIdle ? (
        <div
          className={[
            'tell-morph__layer',
            'tell-morph__layer--idle',
            idleActive ? 'is-active' : '',
            idleExit ? 'is-exiting' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={!idleActive}
        >
          <div className="tell-more-pill tell-more-pill--idle" aria-label={`Tell me more - ${displayLabel} post`}>
            <IdleFace displayLabel={displayLabel} />
          </div>
        </div>
      ) : null}

      {showLoader ? (
        <div
          className={[
            'tell-morph__layer',
            'tell-morph__layer--loader',
            loaderActive ? 'is-active' : '',
            loaderExit ? 'is-exiting' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={!loaderActive}
        >
          <TellAnalysisLoader />
        </div>
      ) : null}

      {showPanel ? (
        <div
          className={[
            'tell-morph__layer',
            'tell-morph__layer--panel',
            panelEnter ? 'is-entering' : '',
            panelActive ? 'is-active' : '',
            phase === 'closing' ? 'is-exiting' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="region"
          aria-label="Inference chain analysis"
          aria-hidden={!panelActive}
        >
          <div
            className={`tell-more-pill tell-more-pill--expanded${isAnalysisRedacted ? ' tell-more-pill--redacted' : ''}`}
          >
            <InferenceChainPanel
              post={highlightedPost}
              personaLabel={label}
              redacted={isAnalysisRedacted}
              onRedactedUnhideConfirm={onRedactedUnhideConfirm}
              onOpenProfile={onOpenProfile}
              authorSlug={authorSlug ?? highlightedPost?.authorSlug ?? null}
              leaderboardDirectorySlugs={leaderboardDirectorySlugs}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
