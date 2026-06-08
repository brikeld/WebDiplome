import { describe, expect, it } from "vitest";

import { nextPanelUi } from "../both-states/panel-state.js";

describe("both-states tell panel disclosure state", () => {
  it("keeps only one expanded detail active across panel sections", () => {
    const withChainOpen = nextPanelUi(
      { activeThinking: null, activeIngredient: null, activeChainStep: null },
      "chain",
      2,
    );

    expect(withChainOpen).toEqual({
      activeThinking: null,
      activeIngredient: null,
      activeChainStep: 2,
    });

    expect(nextPanelUi(withChainOpen, "ingredient", 1)).toEqual({
      activeThinking: null,
      activeIngredient: 1,
      activeChainStep: null,
    });
  });

  it("closes the active detail when the same item is clicked again", () => {
    expect(
      nextPanelUi(
        { activeThinking: 1, activeIngredient: null, activeChainStep: null },
        "thinking",
        1,
      ),
    ).toEqual({
      activeThinking: null,
      activeIngredient: null,
      activeChainStep: null,
    });
  });
});
