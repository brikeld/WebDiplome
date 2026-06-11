import { chromium } from 'playwright';

// Faithful viewport sizes. Real side-panel column = clamp(420, 32vw, 720).
const SCREENS = {
  '13':  { w: 1280, h: 800 },   // MacBook 13"
  '5k':  { w: 2560, h: 1440 },  // 27" 5K (logical)
  '6k':  { w: 3008, h: 1692 },  // 6K-ish logical canvas
};
const CASES = [
  { p: 'productivity', q: 'long'  },
  { p: 'security',     q: 'short' },
  { p: 'popularity',   q: 'long'  },
];

const screen = process.argv[2] || '13';
const tag = process.argv[3] || 'after';
const { w, h } = SCREENS[screen];

const browser = await chromium.launch();
for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(`file://${process.cwd()}/tellmemore-harness.html?p=${c.p}&q=${c.q}`);
  await page.waitForTimeout(500);
  const out = `${tag}-${screen}-${c.p}.png`;
  await page.screenshot({ path: out });
  console.log('wrote', out);
  await page.close();
}
await browser.close();
