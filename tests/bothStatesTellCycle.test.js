import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright";

const root = new URL("..", import.meta.url).pathname;
const mime = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
};

function serveRepo() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = url.pathname === "/" ? "/both-states/index.html" : url.pathname;
      const filePath = normalize(join(root, pathname));
      if (!filePath.startsWith(root)) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, { "content-type": mime[extname(filePath)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function stubMotionOne(page) {
  await page.route("https://cdn.jsdelivr.net/npm/@motionone/dom@10.18.0/+esm", async (route) => {
    await route.fulfill({
      contentType: "text/javascript",
      body: `
        export function animate(targets, keyframes) {
          const elements = Array.isArray(targets) ? targets : [targets];
          const finalValue = (value) => Array.isArray(value) ? value[value.length - 1] : value;
          for (const element of elements) {
            if (!element?.style) continue;
            if (keyframes.opacity !== undefined) element.style.opacity = String(finalValue(keyframes.opacity));
            if (keyframes.filter !== undefined) element.style.filter = String(finalValue(keyframes.filter));
            if (keyframes.y !== undefined) element.style.transform = "translateY(" + finalValue(keyframes.y) + "px)";
            if (keyframes.scaleY !== undefined) element.style.transform = "scaleY(" + finalValue(keyframes.scaleY) + ")";
            if (keyframes.scale !== undefined) element.style.transform = "scale(" + finalValue(keyframes.scale) + ")";
          }
          return { cancel() {} };
        }
        export function stagger() { return 0; }
      `,
    });
  });
}

describe("both-states tell me more cycle", () => {
  it("restores the original idle tell design after closing the expanded panel", async () => {
    const { server, origin } = await serveRepo();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    try {
      await stubMotionOne(page);

      await page.goto(`${origin}/both-states/index.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#tellRow .tell-morph__idle").click({ force: true });
      await page.waitForTimeout(4300);
      await page.locator(".tell-morph__panel").click({ force: true });
      await page.waitForTimeout(2100);

      const state = await page.evaluate(() => ({
        mode: document.querySelector("#capsule")?.dataset.tellMode,
        topOpacity: getComputedStyle(document.querySelector(".tell-idle-a__top")).opacity,
        barsOpacity: getComputedStyle(document.querySelector(".tell-idle-a__bars")).opacity,
        ctaOpacity: getComputedStyle(document.querySelector(".tell-idle-a__cta")).opacity,
      }));

      expect(state).toEqual({
        mode: "idle",
        topOpacity: "1",
        barsOpacity: "1",
        ctaOpacity: "1",
      });
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  }, 15000);

  it("shows the longest data detail directly below its source row without internal scrolling", async () => {
    const { server, origin } = await serveRepo();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    try {
      await stubMotionOne(page);

      await page.goto(`${origin}/both-states/index.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#tellRow .tell-morph__idle").click({ force: true });
      await page.waitForTimeout(4300);
      await page.locator('.ing-section [data-chip-kind="ingredient"][data-chip-index="0"]').click({ force: true });
      await page.waitForTimeout(250);

      const state = await page.evaluate(() => {
        const capsule = document.querySelector("#capsule").getBoundingClientRect();
        const shell = document.querySelector(".tell-morph__panel").getBoundingClientRect();
        const host = document.querySelector(".tell-panel-host").getBoundingClientRect();
        const detail = document.querySelector(".focus-detail").getBoundingClientRect();
        const source = document.querySelector('.ing-section [data-chip-kind="ingredient"][data-chip-index="0"]').getBoundingClientRect();
        const section = document.querySelector(".ing-section").getBoundingClientRect();
        const panel = document.querySelector(".tell-panel-a");
        const panelRect = panel.getBoundingClientRect();
        return {
          detailInsideCapsule: detail.bottom <= capsule.bottom + 1,
          detailBelowSource: detail.top >= source.bottom - 1,
          hostInsideShell: host.left >= shell.left - 1 && host.right <= shell.right + 1,
          panelInsideShell: panelRect.left >= shell.left - 1 && panelRect.right <= shell.right + 1,
          detailInsideShell: detail.left >= shell.left - 1 && detail.right <= shell.right + 1,
          detailInSourceSection: Boolean(document.querySelector(".ing-section .focus-detail")),
          detailUsesSectionWidth: detail.width >= section.width * 0.92,
          usesFocusDetail: panel.classList.contains("tell-panel-a--has-focus"),
          panelOverflowY: getComputedStyle(panel).overflowY,
        };
      });

      expect(state).toEqual({
        detailInsideCapsule: true,
        detailBelowSource: true,
        hostInsideShell: true,
        panelInsideShell: true,
        detailInsideShell: true,
        detailInSourceSection: true,
        detailUsesSectionWidth: true,
        usesFocusDetail: true,
        panelOverflowY: "hidden",
      });
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  }, 15000);
});
