import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../both-states/index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../both-states/both-states.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../both-states/styles.css", import.meta.url), "utf8");

describe("both-states tell me more motion", () => {
  it("loads the Motion One animation plugin for the tell transition", () => {
    expect(html).toContain("motionOneUrl");
    expect(js).toContain("loadMotionOne");
  });

  it("uses a dedicated professional analysis loader during expansion", () => {
    expect(js).toContain("tell-analysis-loader");
    expect(css).toContain(".tell-analysis-loader");
    expect(css).toContain(".tell-analysis-loader__progress");
    expect(css).toContain("opacity: 1 !important");
  });
});
