/**
 * Tell-Me-More panel.
 *
 * Two distinct layouts share this component:
 *
 *   • Leaderboard posts → `LeaderboardRationaleView` (lb2 capsule layout).
 *   • Normal posts      → tell-panel-a layout: compact post quote + analysis
 *                         sections for reasoning, framing, and data inputs.
 *                         Small interactable chips reveal per-section details.
 *
 * Cross-linking from the post quote: clicking a highlighted phrase opens the
 * matching chip (ingredient or inference-chain step).
 */

import { useEffect, useState } from 'react';
import PostTextHighlights from './PostTextHighlights.jsx';
import LeaderboardRationaleView from './LeaderboardRationaleView.jsx';
import RedactedAnalysisOverlay from './RedactedAnalysisOverlay.jsx';
import { useTellMeMoreLoading } from './useTellMeMoreLoading.js';
import TellMeMoreLoadingOverlay from './TellMeMoreLoadingOverlay.jsx';
import { freshPanelUi, nextPanelUi } from './panelState.js';
import { synthesiseChartMetadata } from '@/lib/chartPostMetadata.js';

const CHAIN_KEYS = ['data', 'classify', 'infer'];

function looksLikeInternalKey(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  if (/\s/.test(t)) return false;
  return /[_.\[]/.test(t) && /^[A-Za-z0-9_.\[\]]+$/.test(t);
}

function readableValue(value, fallback) {
  if (looksLikeInternalKey(value)) return fallback;
  return value;
}

function readableSource(source) {
  if (!source) return null;
  return looksLikeInternalKey(source) ? null : source;
}

function isValidChain(chain) {
  if (!Array.isArray(chain)) return false;
  return CHAIN_KEYS.every((s) => {
    const entry = chain.find((c) => c && c.step === s);
    return entry && typeof entry.value === 'string' && entry.value.trim();
  });
}

/**
 * Client-side fallback for posts written before the `thinking` field shipped.
 * Mirrors the server-side `synthesiseThinking` shape so the UI never shows an
 * empty Thinking tile for legacy data.
 */
function synthesiseThinking(post) {
  const chain = Array.isArray(post?.inferenceChain) ? post.inferenceChain : null;
  const ingredients = Array.isArray(post?.ingredients) ? post.ingredients : null;
  if (!chain && !ingredients) return null;

  const out = [];
  const dataStep = chain?.find((s) => s?.step === 'data');
  const inferStep = chain?.find((s) => s?.step === 'infer');
  const heaviest = ingredients?.length
    ? [...ingredients].sort((a, b) => Number(b.weight ?? 0) - Number(a.weight ?? 0))[0]
    : null;

  if (dataStep?.value && !looksLikeInternalKey(dataStep.value)) {
    out.push({ label: 'WHAT I SAW', detail: String(dataStep.value).slice(0, 180) });
  }
  if (heaviest?.label) {
    out.push({ label: 'WHAT WEIGHED MOST', detail: `${heaviest.label} carried the most weight here.` });
  }
  if (inferStep?.value && !looksLikeInternalKey(inferStep.value)) {
    out.push({ label: 'THE LEAP', detail: String(inferStep.value).slice(0, 180) });
  }
  if (inferStep?.biasNote) {
    out.push({ label: 'WHERE I CHEATED', detail: String(inferStep.biasNote).slice(0, 180) });
  }
  return out.length >= 3 ? out : null;
}

function resolvePostAnalysis(post) {
  let chain = post?.inferenceChain;
  let ingredients = Array.isArray(post?.ingredients) ? post.ingredients : null;
  let highlights = Array.isArray(post?.highlights) ? post.highlights : null;
  let rawThinking = Array.isArray(post?.thinking) ? post.thinking : null;

  const chartType = post?.chartType != null ? String(post.chartType).trim() : '';
  const needsChartFallback =
    chartType
    && post?.content
    && (!isValidChain(chain) || !ingredients?.length);

  if (needsChartFallback) {
    const synth = synthesiseChartMetadata({
      content: post.content,
      chartType,
      persona: post.persona,
    });
    if (synth) {
      if (!isValidChain(chain)) chain = synth.inferenceChain;
      if (!ingredients?.length) ingredients = synth.ingredients;
      if (!highlights?.length) highlights = synth.highlights;
      if (!rawThinking?.length) rawThinking = synth.thinking;
    }
  }

  return { chain, ingredients, highlights, rawThinking };
}

function FocusDetail({ eyebrow, children }) {
  return (
    <div className="focus-detail">
      {eyebrow ? <span className="focus-detail__eyebrow">{eyebrow}</span> : null}
      <div className="focus-detail__body">{children}</div>
    </div>
  );
}

export default function InferenceChainPanel({
  post,
  personaLabel,
  holdLoadingOverlay = false,
  skipLoadingOverlay = false,
  redacted = false,
  onRedactedUnhideConfirm = null,
}) {
  const { chain, ingredients, highlights, rawThinking } = resolvePostAnalysis(post);
  const validChain = isValidChain(chain);
  const hasIngredients = !!(ingredients && ingredients.length);
  const thinking = rawThinking && rawThinking.length
    ? rawThinking
    : synthesiseThinking({ ...post, inferenceChain: chain, ingredients });
  const hasThinking = !!(thinking && thinking.length);
  const leaderboard = post?.leaderboard ?? null;
  const isLeaderboardPost = Boolean(leaderboard && Array.isArray(leaderboard.entries));

  const { ready, loadingKey } = useTellMeMoreLoading(
    isLeaderboardPost || skipLoadingOverlay ? [] : [post?.id],
    { blocked: holdLoadingOverlay || skipLoadingOverlay },
  );
  const panelReady = skipLoadingOverlay || ready;

  const [panelUi, setPanelUi] = useState(() => freshPanelUi());
  const { activeThinking, activeIngredient, activeChainStep } = panelUi;
  const hasFocusDetail =
    activeThinking !== null || activeIngredient !== null || activeChainStep !== null;

  const setActiveDetail = (kind, index) => {
    setPanelUi((current) => nextPanelUi(current, kind, index));
  };

  // Reset all chip state on post switch.
  useEffect(() => {
    setPanelUi(freshPanelUi());
  }, [post]);

  const handleHighlightSelect = ({ stepIndex, ingredientIndex }) => {
    const validStep = Number.isFinite(stepIndex) && stepIndex >= 0 && stepIndex < CHAIN_KEYS.length;
    const validIng = Number.isFinite(ingredientIndex) && hasIngredients && ingredientIndex >= 0 && ingredientIndex < ingredients.length;
    if (hasIngredients && validIng) {
      setActiveDetail('ingredient', ingredientIndex);
    } else if (validStep && validChain) {
      setActiveDetail('chain', stepIndex);
    }
  };

  if (isLeaderboardPost) {
    return (
      <div
        className={`inference-panel inference-panel--leaderboard${redacted ? ' inference-panel--redacted' : ''}`}
        role="region"
        aria-label="Tell me more analysis"
      >
        <div className="inference-panel__redacted-content">
          <LeaderboardRationaleView
            leaderboard={leaderboard}
            holdLoadingOverlay={holdLoadingOverlay}
          />
        </div>
        {redacted ? (
          <RedactedAnalysisOverlay
            leaderboard
            post={post}
            personaLabel={personaLabel}
            onUnhideConfirm={onRedactedUnhideConfirm}
          />
        ) : null}
      </div>
    );
  }

  // Resolve chain steps for chip detail strip.
  const findChain = (key) => (Array.isArray(chain) ? chain.find((c) => c && c.step === key) : null) ?? null;
  const dataStep = validChain ? findChain('data') : null;
  const classifyStep = validChain ? findChain('classify') : null;
  const inferStep = validChain ? findChain('infer') : null;
  const chainBuckets = [dataStep, classifyStep, inferStep];
  const simpleChain = validChain
    ? [
        {
          label: 'What we checked',
          value: readableValue(dataStep?.value, 'We checked the strongest activity signal available for this post.'),
          detail: readableSource(dataStep?.source)
            ? `Source: ${readableSource(dataStep.source)}.`
            : 'The post starts from the clearest activity signal in the harvested data.',
          tag: readableSource(dataStep?.source) ?? 'data',
        },
        {
          label: 'What it means',
          value: readableValue(classifyStep?.value, 'The signal was grouped into a persona direction.'),
          detail: classifyStep?.confidence
            ? `The classifier treated this as ${classifyStep.confidence === 'med' ? 'medium' : classifyStep.confidence} confidence.`
            : 'The system turns raw traces into a simple behavioral reading.',
          tag: 'classification',
        },
        {
          label: 'Why this post',
          value: readableValue(inferStep?.value, 'The generated post follows from that persona reading.'),
          detail: inferStep?.biasNote
            ? String(inferStep.biasNote)
            : 'The wording is a generated interpretation, so it can compress or exaggerate the underlying signal.',
          tag: inferStep?.confidence ? `confidence ${inferStep.confidence}` : 'inference',
        },
      ]
    : [];

  return (
    <div
      className={`tell-panel-a tell-panel-a--alt-palette-2 inference-panel${panelReady ? ' is-ready' : ''}${redacted ? ' inference-panel--redacted' : ''}${hasFocusDetail ? ' tell-panel-a--has-focus' : ''}`}
      role="region"
      aria-label="Tell me more analysis"
    >
      {!skipLoadingOverlay && !panelReady ? (
        <TellMeMoreLoadingOverlay loadingKey={loadingKey} />
      ) : null}

      <div className="inference-panel__redacted-content">
      <div className="tell-panel-a__stack">
        {post?.content ? (
          <div className="post-quote-a">
            <PostTextHighlights
              content={post.content}
              highlights={highlights}
              onSelect={handleHighlightSelect}
              activeIngredientIndex={activeIngredient}
            />
          </div>
        ) : null}

        {validChain ? (
          <section className={`tape-section${activeChainStep !== null ? ' tape-section--focus' : ''}`} aria-label="From data to post">
            <header className="panel-a__head">From data to post</header>
            <div className="tape">
              {simpleChain.map((item, i) => (
                <div className="tape__item" key={`${item.label}-${i}`}>
                  <div className="tape__row">
                    <div className="tape__step">
                      <div className="tape__badge">{i + 1}</div>
                      {i < simpleChain.length - 1 ? <div className="tape__line" /> : null}
                    </div>
                    <button
                      type="button"
                      className={`tape__content${activeChainStep === i ? ' is-open' : ''}`}
                      onClick={() => setActiveDetail('chain', i)}
                    >
                      <span className="tape__label">{item.label}</span>
                    </button>
                  </div>
                  {activeChainStep === i ? (
                    <FocusDetail eyebrow={item.tag}>
                      <p>
                        <span className="tape__value">{item.value}</span>
                        <span className="tape__detail">{item.detail}</span>
                      </p>
                    </FocusDetail>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {hasThinking ? (
          <section className={`reason-section${activeThinking !== null ? ' reason-section--focus' : ''}`}>
            <header className="panel-a__head">How we framed it</header>
            <div className="reason-chips">
              {thinking.map((th, i) => (
                <button
                  key={i}
                  type="button"
                  className={`reason-chip${activeThinking === i ? ' is-open' : ''}`}
                  onClick={() => setActiveDetail('thinking', i)}
                >
                  {th.label}
                </button>
              ))}
            </div>
            {activeThinking !== null && thinking[activeThinking] ? (
              <FocusDetail eyebrow="framing">
                <b>{thinking[activeThinking].label}</b>
                <p>{thinking[activeThinking].detail}</p>
              </FocusDetail>
            ) : null}
          </section>
        ) : null}

        {hasIngredients ? (
          <section className={`ing-section${activeIngredient !== null ? ' ing-section--focus' : ''}`}>
            <header className="panel-a__head">Data used</header>
            <div className="ing-bars">
              {ingredients.map((ing, i) => {
                const weight = Math.max(5, Math.min(100, Math.round(Number(ing?.weight) || 50)));
                const dataPoints = ing?.dataPoints || ing?.points || [];
                return (
                  <div className="ing-bar__item" key={`${ing.label}-${i}`}>
                    <button
                      type="button"
                      className={`ing-bar__row${activeIngredient === i ? ' is-open' : ''}`}
                      onClick={() => setActiveDetail('ingredient', i)}
                    >
                      <span className="ing-bar__label">{ing.label}</span>
                      <span className="ing-bar__track">
                        <span className="ing-bar__fill" style={{ width: `${weight}%` }} />
                      </span>
                      <span className="ing-bar__pct">{weight}%</span>
                    </button>
                    {activeIngredient === i ? (
                      <FocusDetail eyebrow="evidence">
                        <b>{ing.label}</b>
                        {dataPoints.length ? (
                          <ul>
                            {dataPoints.slice(0, 12).map((dp, di) => (
                              <li key={di}>{dp}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>This signal contributed {weight}% to the post rationale.</p>
                        )}
                        {dataPoints.length > 12 ? (
                          <p>+{dataPoints.length - 12} more</p>
                        ) : null}
                      </FocusDetail>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {!hasThinking && !hasIngredients && !validChain ? (
          <div className="panel-a__detail">
            <p>Analysis not available for this post.</p>
          </div>
        ) : null}
      </div>
      </div>
      {redacted ? (
        <RedactedAnalysisOverlay
          post={post}
          personaLabel={personaLabel}
          onUnhideConfirm={onRedactedUnhideConfirm}
        />
      ) : null}
    </div>
  );
}
