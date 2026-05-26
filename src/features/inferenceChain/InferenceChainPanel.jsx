/**
 * The panel that fills the dashboard capsule when "Tell me more" is expanded.
 *
 * Layout (top → bottom):
 *   1. Persona kicker + title + close button
 *   2. Post content, with phrases from `post.highlights` rendered as clickable
 *      buttons (each one links a step + an ingredient)
 *   3. Pill toggle: Ingredients | Inference Chain
 *   4. Content area — either the ingredient bars or the inference chain (data → classify → infer)
 *
 * Cross-linking:
 *   - Clicking a highlighted phrase switches to the Ingredients view and opens
 *     the linked ingredient row.
 *   - Switching back to the Chain view, the linked step briefly pulses.
 */

import { useEffect, useState } from 'react';
import { StepRow, InferStepRow } from './inferenceChainSteps.jsx';
import IngredientsView from './IngredientsView.jsx';
import PostTextHighlights from './PostTextHighlights.jsx';

function findStep(chain, step) {
  return Array.isArray(chain) ? chain.find((s) => s && s.step === step) ?? null : null;
}

// Catch internal-looking key paths so we don't leak them through old posts that
// were generated before the prompt enforced human-readable sources/values.
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
  if (!Array.isArray(chain) || chain.length !== 4) return false;
  const required = ['data', 'classify', 'infer', 'generate'];
  return required.every((s) => {
    const entry = chain.find((c) => c && c.step === s);
    return entry && typeof entry.value === 'string' && entry.value.trim();
  });
}


export default function InferenceChainPanel({ post, personaLabel, onClose }) {
  const chain = post?.inferenceChain;
  const ingredients = Array.isArray(post?.ingredients) ? post.ingredients : null;
  const highlights = Array.isArray(post?.highlights) ? post.highlights : null;
  const validChain = isValidChain(chain);
  const hasIngredients = !!(ingredients && ingredients.length);

  // Default to Inference Chain when present; otherwise Ingredients.
  const [view, setView] = useState(validChain ? 'chain' : 'ingredients');
  const [expandedIngredients, setExpandedIngredients] = useState(() => new Set());
  const [pulseStep, setPulseStep] = useState({ index: -1, key: 0 });

  // Reset when switching posts.
  useEffect(() => {
    setView(validChain ? 'chain' : 'ingredients');
    setExpandedIngredients(new Set());
    setPulseStep({ index: -1, key: 0 });
  }, [post, validChain]);

  // Clear the pulse after a brief moment so it can re-fire on next click.
  useEffect(() => {
    if (pulseStep.index === -1) return undefined;
    const id = setTimeout(() => setPulseStep((p) => ({ ...p, index: -1 })), 900);
    return () => clearTimeout(id);
  }, [pulseStep]);

  const handleHighlightSelect = ({ stepIndex, ingredientIndex }) => {
    const validStep = Number.isFinite(stepIndex) && stepIndex >= 0 && stepIndex <= 2;
    const validIng = Number.isFinite(ingredientIndex) && hasIngredients && ingredientIndex >= 0 && ingredientIndex < ingredients.length;
    if (hasIngredients && validIng) {
      setView('ingredients');
      setExpandedIngredients((prev) => new Set([...prev, ingredientIndex]));
    } else if (validStep) {
      setView('chain');
      setPulseStep({ index: stepIndex, key: Date.now() });
    }
  };

  const handleToggleIngredient = (index) => {
    setExpandedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSetView = (next) => {
    if (next === view) return;
    setView(next);
  };

  return (
    <div className="inference-panel" role="region" aria-label="Algorithm inference chain">
      <header className="inference-panel__head">
        <div className="inference-panel__title-group">
          <span className="inference-panel__kicker">
            {personaLabel ? `${personaLabel.toLowerCase()} persona` : 'inference chain'}
          </span>
          <h3 className="inference-panel__title">How the system reached this post</h3>
        </div>
        <button
          type="button"
          className="inference-panel__close"
          onClick={onClose}
          aria-label="Collapse analysis"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden width="20" height="20">
            <path d="M18.3 5.71 12 12.01 5.7 5.71 4.29 7.12 10.59 13.42 4.29 19.71 5.7 21.12 12 14.83 18.3 21.12 19.71 19.71 13.41 13.42 19.71 7.12z" />
          </svg>
        </button>
      </header>

      {post?.content ? (
        <PostTextHighlights
          content={post.content}
          highlights={highlights}
          onSelect={handleHighlightSelect}
        />
      ) : null}

      {(validChain && hasIngredients) ? (
        <div className="inference-panel__toggle" role="tablist" aria-label="Analysis view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'ingredients'}
            className={`inference-panel__toggle-btn${view === 'ingredients' ? ' is-active' : ''}`}
            onClick={() => handleSetView('ingredients')}
          >
            Ingredients
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'chain'}
            className={`inference-panel__toggle-btn${view === 'chain' ? ' is-active' : ''}`}
            onClick={() => handleSetView('chain')}
          >
            Inference Chain
          </button>
        </div>
      ) : null}

      <div className="inference-panel__body">
        {view === 'chain' && validChain ? (
          <ol className="inference-panel__steps" aria-label="Inference steps">
            <StepRow
              step="data"
              value={readableValue(findStep(chain, 'data').value, 'A signal from the user’s machine data')}
              source={readableSource(findStep(chain, 'data').source)}
              showConnector
              pulse={pulseStep.index === 0 ? pulseStep.key : 0}
            />
            <StepRow
              step="classify"
              value={findStep(chain, 'classify').value}
              confidence={findStep(chain, 'classify').confidence ?? 'high'}
              showConnector
              pulse={pulseStep.index === 1 ? pulseStep.key : 0}
            />
            <InferStepRow
              value={findStep(chain, 'infer').value}
              confidence={findStep(chain, 'infer').confidence ?? 'low'}
              isBiased={findStep(chain, 'infer').isBiased === true}
              biasNote={findStep(chain, 'infer').biasNote}
              pulse={pulseStep.index === 2 ? pulseStep.key : 0}
            />
          </ol>
        ) : view === 'ingredients' && hasIngredients ? (
          <IngredientsView
            ingredients={ingredients}
            expandedIndices={expandedIngredients}
            onToggleExpand={handleToggleIngredient}
          />
        ) : (
          <div className="inference-panel__empty">
            <p>Analysis not available for this post.</p>
          </div>
        )}
      </div>
    </div>
  );
}
