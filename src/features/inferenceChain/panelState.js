export function freshPanelUi() {
  return { activeThinking: null, activeIngredient: null, activeChainStep: null };
}

export function nextPanelUi(currentUi, kind, index) {
  const next = freshPanelUi();

  if (kind === 'thinking' && currentUi.activeThinking !== index) {
    next.activeThinking = index;
  } else if (kind === 'ingredient' && currentUi.activeIngredient !== index) {
    next.activeIngredient = index;
  } else if (kind === 'chain' && currentUi.activeChainStep !== index) {
    next.activeChainStep = index;
  }

  return next;
}
