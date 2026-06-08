import { describe, expect, it } from 'vitest';
import { freshPanelUi, nextPanelUi } from '../src/features/inferenceChain/panelState.js';

describe('normal post tell-me-more panel state', () => {
  it('opens only one detail at a time and toggles the active detail closed', () => {
    expect(nextPanelUi(freshPanelUi(), 'ingredient', 1)).toEqual({
      activeThinking: null,
      activeIngredient: 1,
      activeChainStep: null,
    });

    expect(nextPanelUi({ activeThinking: null, activeIngredient: 1, activeChainStep: null }, 'thinking', 2)).toEqual({
      activeThinking: 2,
      activeIngredient: null,
      activeChainStep: null,
    });

    expect(nextPanelUi({ activeThinking: 2, activeIngredient: null, activeChainStep: null }, 'thinking', 2)).toEqual(
      freshPanelUi(),
    );
  });
});
