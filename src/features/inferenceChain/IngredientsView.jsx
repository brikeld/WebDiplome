/**
 * "Ingredients" view — companion to the chain view.
 *
 * Shows up to 3 data-category bars (label + weight bar) per post. Each row is
 * a button; clicking expands it to reveal the raw data points as small pills.
 * Multiple rows can be open at the same time.
 *
 * Expanded indices live in the parent so a highlight click in the post text
 * can open a specific row without closing others.
 */

function clampWeight(w) {
  const n = Number(w);
  if (!Number.isFinite(n)) return 50;
  return Math.max(5, Math.min(100, Math.round(n)));
}

export default function IngredientsView({
  ingredients,
  expandedIndices,
  onToggleExpand,
}) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return (
      <div className="inference-panel__empty">
        <p>Ingredient breakdown not available for this post.</p>
      </div>
    );
  }

  const openSet =
    expandedIndices instanceof Set
      ? expandedIndices
      : new Set(Array.isArray(expandedIndices) ? expandedIndices : []);

  return (
    <ul className="ingredients-list" aria-label="Data ingredients">
      {ingredients.map((ing, i) => {
        const weight = clampWeight(ing.weight);
        const isOpen = openSet.has(i);
        return (
          <li
            key={`${ing.label}-${i}`}
            className={`ingredient-row${isOpen ? ' ingredient-row--open' : ''}`}
          >
            <button
              type="button"
              className="ingredient-row__head"
              aria-expanded={isOpen}
              onClick={() => onToggleExpand?.(i)}
            >
              <span className="ingredient-row__label">{ing.label}</span>
              <span className="ingredient-row__meta">
                <span className="ingredient-row__weight">{weight}%</span>
                <svg
                  className="ingredient-row__chevron"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M6 8.5 1.5 4h9z" />
                </svg>
              </span>
              <span className="ingredient-row__bar" aria-hidden>
                <span
                  className="ingredient-row__bar-fill"
                  style={{ width: `${weight}%` }}
                />
              </span>
            </button>
            {isOpen ? (
              <div className="ingredient-row__points">
                {Array.isArray(ing.dataPoints) && ing.dataPoints.length > 0 ? (
                  ing.dataPoints.map((p, pi) => (
                    <span
                      key={`${i}-${pi}`}
                      className="ingredient-row__pill"
                      title={p}
                    >
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="ingredient-row__pill ingredient-row__pill--empty">
                    No data points
                  </span>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
