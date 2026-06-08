import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const js = readFileSync(new URL("../both-states/both-states.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../both-states/styles.css", import.meta.url), "utf8");

describe("both-states expanded layout CSS", () => {
  it("uses the same specificity as the base capsule rule for expanded height", () => {
    expect(css).toContain(
      ".dashboard-capsule.dashboard-capsule--figma.dashboard-capsule--both.is-tell-expanded",
    );
  });

  it("does not clip the active expanded detail card to the old compact max height", () => {
    expect(css).not.toContain("max-height: 5.5em");
  });

  it("removes the quote title and sizes the post like normal panel text", () => {
    expect(js).not.toContain("Why this CONTENT?");
    expect(css).toContain("--both-quote-fs: var(--both-label-fs)");
    expect(css).toContain("--both-quote-section-pad: clamp(5px, 0.65vh, 8px)");
  });
});
