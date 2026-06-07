/**
 * Tell-Me-More panel.
 *
 * Two distinct layouts share this component:
 *
 *   • Leaderboard posts → `LeaderboardRationaleView` (lb2 capsule layout).
 *   • Normal posts      → np2 layout: bigger post quote + 3 capsule tiles
 *                         (Thinking process / Ingredients / Reasoning steps),
 *                         each with small interactable chips that reveal a
 *                         per-tile detail strip on click.
 *
 * Cross-linking from the post quote: clicking a highlighted phrase opens the
 * matching chip (ingredient or inference-chain step) and scrolls focus into
 * the right tile via `activeIngredient` / `activeChainStep`.
 */

import { useEffect, useState } from 'react';
import PostTextHighlights from './PostTextHighlights.jsx';
import LeaderboardRationaleView from './LeaderboardRationaleView.jsx';
import RedactedAnalysisBackdrop from './RedactedAnalysisBackdrop.jsx';
import RedactedAnalysisOverlay from './RedactedAnalysisOverlay.jsx';
import { useTellMeMoreLoading } from './useTellMeMoreLoading.js';
import TellMeMoreLoadingOverlay from './TellMeMoreLoadingOverlay.jsx';
import { synthesiseChartMetadata } from '@/lib/chartPostMetadata.js';

const CHAIN_LABELS = ['DATA', 'CLASSIFY', 'INFER'];
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

export default function InferenceChainPanel({
  post,
  personaLabel,
  holdLoadingOverlay = false,
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
    isLeaderboardPost ? [] : [post?.id],
    { blocked: holdLoadingOverlay },
  );

  const [activeThinking, setActiveThinking] = useState(null);
  const [activeIngredient, setActiveIngredient] = useState(null);
  const [activeChainStep, setActiveChainStep] = useState(null);

  // Reset all chip state on post switch.
  useEffect(() => {
    setActiveThinking(null);
    setActiveIngredient(null);
    setActiveChainStep(null);
  }, [post]);

  // Click on a phrase in the post text → open the linked capsule.
  const handleHighlightSelect = ({ stepIndex, ingredientIndex }) => {
    const validStep = Number.isFinite(stepIndex) && stepIndex >= 0 && stepIndex < CHAIN_KEYS.length;
    const validIng = Number.isFinite(ingredientIndex) && hasIngredients && ingredientIndex >= 0 && ingredientIndex < ingredients.length;
    if (hasIngredients && validIng) {
      setActiveIngredient(ingredientIndex);
      setActiveChainStep(null);
    } else if (validStep && validChain) {
      setActiveChainStep(stepIndex);
      setActiveIngredient(null);
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
          {redacted ? (
            <RedactedAnalysisBackdrop leaderboard />
          ) : (
            <LeaderboardRationaleView
              leaderboard={leaderboard}
              holdLoadingOverlay={holdLoadingOverlay}
            />
          )}
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

  return (
    <div
      className={`inference-panel${ready ? ' is-ready' : ''}${redacted ? ' inference-panel--redacted' : ''}`}
      role="region"
      aria-label="Tell me more analysis"
    >
      {!redacted ? <TellMeMoreLoadingOverlay loadingKey={loadingKey} /> : null}

      <div className="inference-panel__redacted-content">
      {redacted ? (
        <RedactedAnalysisBackdrop />
      ) : (
      <div className="np2">
        {/* ── Post quote (big) ───────────────────────────────────── */}
        {post?.content ? (
          <div className="np2__quote">
            {personaLabel ? (
              <span className="np2__kicker">{personaLabel.toLowerCase()} persona</span>
            ) : null}
            <PostTextHighlights
              content={post.content}
              highlights={highlights}
              onSelect={handleHighlightSelect}
            />
          </div>
        ) : null}

        {/* ── Thinking process tile ──────────────────────────────── */}
        {hasThinking ? (
          <section className="np2__tile np2__tile--thinking">
            <header className="np2__tile-head">
              <span className="np2__label">THINKING PROCESS</span>
              <span className="np2__label np2__label--hint">tap to read</span>
            </header>
            <div className="np2__chip-grid">
              {thinking.map((th, i) => (
                <button
                  key={i}
                  type="button"
                  className={`np2__chip${activeThinking === i ? ' is-active' : ''}`}
                  onClick={() => setActiveThinking((p) => (p === i ? null : i))}
                >
                  <span className="np2__chip-text">{th.label}</span>
                </button>
              ))}
            </div>
            {activeThinking !== null && thinking[activeThinking] ? (
              <div className="np2__detail">
                <span className="np2__label">{thinking[activeThinking].label}</span>
                <p className="np2__detail-value">{thinking[activeThinking].detail}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── Ingredients tile ───────────────────────────────────── */}
        {hasIngredients ? (
          <section className="np2__tile np2__tile--ingredients">
            <header className="np2__tile-head">
              <span className="np2__label">INGREDIENTS</span>
              <span className="np2__label np2__label--hint">what fed the post</span>
            </header>
            <div className="np2__chip-grid">
              {ingredients.map((ing, i) => {
                const weight = Math.max(5, Math.min(100, Math.round(Number(ing?.weight) || 50)));
                return (
                  <button
                    key={`${ing.label}-${i}`}
                    type="button"
                    className={`np2__chip np2__chip--weighted${activeIngredient === i ? ' is-active' : ''}`}
                    onClick={() => setActiveIngredient((p) => (p === i ? null : i))}
                  >
                    <span className="np2__chip-mark">{weight}%</span>
                    <span className="np2__chip-text">{ing.label}</span>
                  </button>
                );
              })}
            </div>
            {activeIngredient !== null && ingredients[activeIngredient] ? (
              <div className="np2__detail">
                <span className="np2__label">{ingredients[activeIngredient].label?.toUpperCase?.() || 'INGREDIENT'}</span>
                <ul className="np2__detail-list">
                  {(ingredients[activeIngredient].dataPoints || []).slice(0, 12).map((dp, di) => (
                    <li key={di} className="np2__detail-item">{dp}</li>
                  ))}
                </ul>
                {(ingredients[activeIngredient].dataPoints || []).length > 12 ? (
                  <p className="np2__detail-more">
                    +{(ingredients[activeIngredient].dataPoints || []).length - 12} more
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── From data to post tile ─────────────────────────────── */}
        {validChain ? (
          <section className="np2__tile np2__tile--chain">
            <header className="np2__tile-head">
              <span className="np2__label">FROM DATA TO POST</span>
              <span className="np2__label np2__label--hint">step by step</span>
            </header>
            <div className="np2__chip-grid np2__chip-grid--chain">
              {chainBuckets.map((entry, i) => (
                <button
                  key={CHAIN_KEYS[i]}
                  type="button"
                  className={`np2__chip np2__chip--chain${activeChainStep === i ? ' is-active' : ''}`}
                  onClick={() => setActiveChainStep((p) => (p === i ? null : i))}
                >
                  <span className="np2__chip-mark np2__chip-mark--chain">{i + 1}</span>
                  <span className="np2__chip-text">{CHAIN_LABELS[i]}</span>
                </button>
              ))}
            </div>
            {activeChainStep !== null && chainBuckets[activeChainStep] ? (
              <ChainStepDetail
                index={activeChainStep}
                entry={chainBuckets[activeChainStep]}
              />
            ) : null}
          </section>
        ) : null}

        {/* Posts with neither chain nor ingredients (e.g. some legacy/wifi posts). */}
        {!hasThinking && !hasIngredients && !validChain ? (
          <div className="np2__empty">
            <p>Analysis not available for this post.</p>
          </div>
        ) : null}
      </div>
      )}
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

function ChainStepDetail({ index, entry }) {
  const value = readableValue(entry?.value, '—');
  const source = index === 0 ? readableSource(entry?.source) : null;
  const conf = entry?.confidence ?? (index === 2 ? 'low' : null);
  const isBiased = index === 2 && entry?.isBiased === true;
  const biasNote = isBiased && entry?.biasNote ? entry.biasNote : null;

  return (
    <div className="np2__detail">
      <span className="np2__label">{CHAIN_LABELS[index]}</span>
      <p className="np2__detail-value">{value}</p>
      {source ? (
        <p className="np2__detail-meta">
          <span className="np2__detail-meta-tag">source</span>
          <span>{source}</span>
        </p>
      ) : null}
      {conf ? (
        <p className="np2__detail-meta">
          <span className="np2__detail-meta-tag">confidence</span>
          <span>{conf === 'med' ? 'medium' : conf}</span>
        </p>
      ) : null}
      {biasNote ? (
        <p className="np2__detail-bias">{biasNote}</p>
      ) : null}
    </div>
  );
}
