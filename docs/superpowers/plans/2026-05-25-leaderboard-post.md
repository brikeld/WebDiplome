# Leaderboard Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th conditional post type ("leaderboard") that ranks the real user against 4 Alex-Johnson clones across 7 themed boards and only fires a new post when the user's rank on a board changes (or appears for the first time).

**Architecture:** A new pure module `server/lib/leaderboards.js` defines board metadata, deterministic clone scoring, per-board heuristic score functions, and the pick-which-board-to-post-about logic. `server/lib/personaPostGenerator.js` gains a 4th slot that runs in parallel with the existing three and may resolve to `null` (skipped). The post envelope adds a `leaderboard` field; `PostCard.jsx` branches on it to render a new `LeaderboardBlock` React component. Source-of-truth for "last posted rank" is the existing `posts/{id}.json` — no new state file.

**Tech Stack:** Node 20 ESM, Express 5, React 18, Vite 5, Vitest 4. Existing project conventions: pure-helper functions tested with vitest, React components paired with `.css` siblings in `src/features/feed/`.

**Spec:** `docs/superpowers/specs/2026-05-25-leaderboard-post-design.md`

---

## Task 1: Pure helpers — decay, clone scoring, identity constants

**Files:**
- Create: `server/lib/leaderboards.js`
- Test: `tests/leaderboards.test.js`

- [ ] **Step 1: Write failing tests for decay, scoreCloneFor, and identity constants**

Create `tests/leaderboards.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  decay,
  scoreCloneFor,
  FAKE_CLONE_IDENTITY,
  FAKE_CLONE_COUNT,
  CLONE_DRIFT_BUCKET_MS,
} from '../server/lib/leaderboards.js';

describe('decay(nowHour, peakHour)', () => {
  it('returns 1 at the peak hour', () => {
    expect(decay(11, 11)).toBeCloseTo(1, 5);
  });

  it('returns -1 twelve hours from peak (antipeak)', () => {
    expect(decay(23, 11)).toBeCloseTo(-1, 5);
  });

  it('returns 0 six hours from peak', () => {
    expect(decay(17, 11)).toBeCloseTo(0, 5);
    expect(decay(5, 11)).toBeCloseTo(0, 5);
  });

  it('wraps across midnight', () => {
    expect(decay(1, 23)).toBeCloseTo(decay(23, 1), 5);
  });
});

describe('FAKE_CLONE_IDENTITY + FAKE_CLONE_COUNT', () => {
  it('matches the demo commenter identity used elsewhere', () => {
    expect(FAKE_CLONE_IDENTITY.displayName).toBe('Alex Johnson');
    expect(FAKE_CLONE_IDENTITY.handle).toBe('@AlexLaptop');
    expect(FAKE_CLONE_IDENTITY.avatarSrc).toBe('/imgs/AlexP.png');
  });

  it('exposes 4 clones', () => {
    expect(FAKE_CLONE_COUNT).toBe(4);
  });
});

describe('scoreCloneFor', () => {
  it('is deterministic for the same boardId / cloneIdx / nowMs', () => {
    const t = 1_700_000_000_000;
    expect(scoreCloneFor('most_productive', 0, t)).toBe(
      scoreCloneFor('most_productive', 0, t),
    );
  });

  it('differs across cloneIdx for the same board / nowMs', () => {
    const t = 1_700_000_000_000;
    const a = scoreCloneFor('most_productive', 0, t);
    const b = scoreCloneFor('most_productive', 1, t);
    const c = scoreCloneFor('most_productive', 2, t);
    const d = scoreCloneFor('most_productive', 3, t);
    expect(new Set([a, b, c, d]).size).toBeGreaterThan(1);
  });

  it('changes when the 10-minute drift bucket advances', () => {
    const t1 = 1_700_000_000_000;
    const t2 = t1 + CLONE_DRIFT_BUCKET_MS;
    expect(scoreCloneFor('most_productive', 0, t1)).not.toBe(
      scoreCloneFor('most_productive', 0, t2),
    );
  });

  it('does NOT change inside a single 10-minute bucket', () => {
    const t1 = 1_700_000_000_000;
    const t2 = t1 + CLONE_DRIFT_BUCKET_MS - 1;
    expect(scoreCloneFor('most_productive', 0, t1)).toBe(
      scoreCloneFor('most_productive', 0, t2),
    );
  });

  it('returns a finite number', () => {
    const t = Date.now();
    for (let i = 0; i < 4; i++) {
      const s = scoreCloneFor('most_productive', i, t);
      expect(Number.isFinite(s)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run tests/leaderboards.test.js`
Expected: FAIL — module `server/lib/leaderboards.js` not found.

- [ ] **Step 3: Implement the helpers**

Create `server/lib/leaderboards.js`:

```js
/**
 * Leaderboard scoring + selection.
 *
 * Pure module. No I/O. All randomness is seeded from inputs so generation
 * is reproducible within a 10-minute "drift bucket".
 */

import crypto from 'crypto';

/** Demo Alex Johnson identity (matches src/lib/demoCommentIdentity.js). */
export const FAKE_CLONE_IDENTITY = Object.freeze({
  displayName: 'Alex Johnson',
  handle: '@AlexLaptop',
  avatarSrc: '/imgs/AlexP.png',
  avatarInitials: 'AJ',
});

export const FAKE_CLONE_COUNT = 4;

/** Clones re-roll their scores every 10 minutes; keeps the demo lively. */
export const CLONE_DRIFT_BUCKET_MS = 10 * 60 * 1000;

/**
 * Time-decay weight in [-1, 1].
 *   1 at peakHour, -1 twelve hours away, 0 six hours away.
 *   cos((nowHour - peakHour) * π / 12)
 */
export function decay(nowHour, peakHour) {
  const delta = (Number(nowHour) - Number(peakHour)) * (Math.PI / 12);
  return Math.cos(delta);
}

function seededFloat(seedStr) {
  const hex = crypto.createHash('sha256').update(seedStr).digest('hex').slice(0, 8);
  // 32-bit unsigned int → [0, 1)
  return parseInt(hex, 16) / 0x1_0000_0000;
}

/**
 * Deterministic clone score for a given board.
 * Range tuned so clones land near the user's realistic-score range; can occasionally outrank.
 */
export function scoreCloneFor(boardId, cloneIdx, nowMs) {
  const bucket = Math.floor(nowMs / CLONE_DRIFT_BUCKET_MS);
  const f = seededFloat(`${boardId}|${cloneIdx}|${bucket}`);
  // Centered around 40 with ±35 swing; gives a -5..75 envelope shared across boards.
  return Math.round((f * 70 - 35 + 40) * 100) / 100;
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run tests/leaderboards.test.js`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/leaderboards.js tests/leaderboards.test.js
git commit -m "feat(leaderboards): decay + clone scoring + identity constants"
```

---

## Task 2: Board definitions + 7 score functions

**Files:**
- Modify: `server/lib/leaderboards.js` (add BOARDS + scoreFns)
- Modify: `tests/leaderboards.test.js` (add board tests)

- [ ] **Step 1: Write failing tests for BOARDS metadata and per-board scoring**

Append to `tests/leaderboards.test.js`:

```js
import { BOARDS } from '../server/lib/leaderboards.js';

describe('BOARDS', () => {
  it('declares all 7 boards in priority order', () => {
    expect(BOARDS.map(b => b.id)).toEqual([
      'most_productive',
      'closest_to_burnout',
      'most_likely_change_jobs',
      'ignoring_health',
      'most_secure',
      'most_socially_isolated',
      'most_likely_ghost',
    ]);
  });

  it('every board declares id, title, persona, peakHour, scoreFn', () => {
    for (const b of BOARDS) {
      expect(typeof b.id).toBe('string');
      expect(typeof b.title).toBe('string');
      expect(['productivite', 'securite', 'popularite']).toContain(b.persona);
      expect(typeof b.peakHour).toBe('number');
      expect(b.peakHour).toBeGreaterThanOrEqual(0);
      expect(b.peakHour).toBeLessThanOrEqual(23);
      expect(typeof b.scoreFn).toBe('function');
    }
  });
});

describe('scoreFn(dataJson, profile, nowMs) for every board', () => {
  // Static nowMs at hour 11 UTC so decay results are predictable across boards.
  const NOW_MS_11 = new Date('2026-05-25T11:00:00Z').getTime();

  const richData = {
    MACHINE_IDENTITY: {
      installed_apps: [
        'Cursor', 'Visual Studio Code', 'Figma', 'Notion',
        'Adobe Photoshop 2025', 'NordVPN', 'GlobalProtect',
        'Discord', 'Slack',
      ],
    },
    PAST_HISTORY: {
      app_usage_7days: [
        { app: 'Cursor',   last_used: '2026-05-25T10:00:00Z' },
        { app: 'Figma',    last_used: '2026-05-25T10:30:00Z' },
        { app: 'Notion',   last_used: '2026-05-24T22:00:00Z' },
        { app: 'Adobe Photoshop 2025', last_used: '2026-05-24T23:30:00Z' },
        { app: 'Slack',    last_used: '2026-05-25T09:00:00Z' },
        { app: 'Discord',  last_used: '2026-05-25T08:00:00Z' },
      ],
      recent_files_7days: [
        { date: '2026-05-25T23:30:00Z' },
        { date: '2026-05-25T00:30:00Z' },
        { date: '2026-05-25T10:00:00Z' },
      ],
      browser_history: {
        chrome: [
          { url: 'https://www.linkedin.com/jobs', title: 'Jobs' },
          { url: 'https://github.com/foo', title: 'GitHub' },
        ],
        safari: [],
      },
      wifi_history: ['Home-5G', 'Office', 'Ginevra Cafe', 'COFFEE PAGE'],
      recent_downloads: [],
    },
  };

  const leanData = {
    MACHINE_IDENTITY: { installed_apps: ['Spotify', 'Netflix'] },
    PAST_HISTORY: {
      app_usage_7days: [
        { app: 'Spotify', last_used: '2026-05-25T10:00:00Z' },
        { app: 'Netflix', last_used: '2026-05-25T11:00:00Z' },
      ],
      recent_files_7days: [],
      browser_history: { chrome: [], safari: [] },
      wifi_history: ['Home'],
      recent_downloads: [],
    },
  };

  const profile = { personaScores: { productivity: 60, security: 40, social: 50 } };

  for (const board of BOARDS) {
    it(`${board.id} returns { score: number, hint: string }`, () => {
      const r = board.scoreFn(richData, profile, NOW_MS_11);
      expect(typeof r).toBe('object');
      expect(typeof r.score).toBe('number');
      expect(Number.isFinite(r.score)).toBe(true);
      expect(typeof r.hint).toBe('string');
      expect(r.hint.length).toBeGreaterThan(0);
    });
  }

  it('most_productive scores higher with work/creative apps than with entertainment-only', () => {
    const board = BOARDS.find(b => b.id === 'most_productive');
    const rich = board.scoreFn(richData, profile, NOW_MS_11);
    const lean = board.scoreFn(leanData, profile, NOW_MS_11);
    expect(rich.score).toBeGreaterThan(lean.score);
  });

  it('most_secure scores higher with VPN apps installed', () => {
    const board = BOARDS.find(b => b.id === 'most_secure');
    const rich = board.scoreFn(richData, profile, NOW_MS_11);
    const lean = board.scoreFn(leanData, profile, NOW_MS_11);
    expect(rich.score).toBeGreaterThan(lean.score);
  });

  it('most_socially_isolated scores higher with fewer social apps used', () => {
    const board = BOARDS.find(b => b.id === 'most_socially_isolated');
    const rich = board.scoreFn(richData, profile, NOW_MS_11);
    const lean = board.scoreFn(leanData, profile, NOW_MS_11);
    // lean data has zero social-app usage → more isolated
    expect(lean.score).toBeGreaterThan(rich.score);
  });

  it('scores shift with nowMs (time-decay drives change)', () => {
    const board = BOARDS.find(b => b.id === 'most_productive');
    const t11 = new Date('2026-05-25T11:00:00Z').getTime();  // peak
    const t23 = new Date('2026-05-25T23:00:00Z').getTime();  // antipeak
    const a = board.scoreFn(richData, profile, t11).score;
    const b = board.scoreFn(richData, profile, t23).score;
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run tests/leaderboards.test.js`
Expected: FAIL — `BOARDS` not exported yet.

- [ ] **Step 3: Implement BOARDS + scoreFns in `server/lib/leaderboards.js`**

Append below the existing exports:

```js
// ─── App categories used by scoring (mirrors dataSlices.js sets) ───────────

const WORK_APPS = new Set([
  'Visual Studio Code','Cursor','Windsurf','Xcode','GitHub Desktop','Figma','Notion',
  'Microsoft Teams','Keynote','Pages','Numbers','Arduino IDE','Godot','Blender',
  'Blender 4.5.3 LTS','WebStorm','PyCharm','IntelliJ IDEA','Sublime Text',
]);
const CREATIVE_APPS_PREFIX = 'Adobe';
const CREATIVE_APPS = new Set([
  'Blender','Blender 4.5.3 LTS','DiffusionBee','GoPro Player','HandBrake',
  'ideaMaker','GIMP','Inkscape','Sketch','Figma',
]);
const ENTERTAINMENT_APPS = new Set([
  'Spotify','VLC','DAZN','Stremio','Epic Games Launcher','Netflix','Plex','Twitch',
]);
const SOCIAL_APPS = new Set([
  'Discord','WhatsApp','Microsoft Teams','Slack','Telegram','Skype','Messenger','Signal',
]);
const COMMS_APPS = new Set([
  'Discord','WhatsApp','Microsoft Teams','Slack','Telegram','Skype','Messenger','Signal','Mail',
]);
const VPN_APPS = new Set([
  'NordVPN','GlobalProtect','ProtonVPN','Little Snitch','Mullvad','ExpressVPN','Wireguard',
]);
const TORRENT_APPS = new Set([
  'qbittorrent','uTorrent','Transmission','BitTorrent',
]);
const HEALTH_APPS = new Set([
  'Health','Strava','Apple Fitness','Sleep Cycle','MyFitnessPal','Headspace','Calm',
]);

function isCreative(app) {
  if (CREATIVE_APPS.has(app)) return true;
  return typeof app === 'string' && app.startsWith(CREATIVE_APPS_PREFIX);
}

function countInUsage(usage, predicate) {
  return usage.filter((u) => predicate(u?.app)).length;
}

function safeUsage(data) {
  return Array.isArray(data?.PAST_HISTORY?.app_usage_7days)
    ? data.PAST_HISTORY.app_usage_7days
    : [];
}

function safeInstalled(data) {
  return Array.isArray(data?.MACHINE_IDENTITY?.installed_apps)
    ? data.MACHINE_IDENTITY.installed_apps
    : [];
}

function safeFiles(data) {
  return Array.isArray(data?.PAST_HISTORY?.recent_files_7days)
    ? data.PAST_HISTORY.recent_files_7days
    : [];
}

function safeWifi(data) {
  return Array.isArray(data?.PAST_HISTORY?.wifi_history)
    ? data.PAST_HISTORY.wifi_history
    : [];
}

function safeBrowserUrls(data) {
  const bh = data?.PAST_HISTORY?.browser_history || {};
  const all = [
    ...(Array.isArray(bh.chrome) ? bh.chrome : []),
    ...(Array.isArray(bh.safari) ? bh.safari : []),
  ];
  return all.map((e) => String(e?.url ?? '')).filter(Boolean);
}

function lateNightFileCount(data) {
  const files = safeFiles(data);
  let n = 0;
  for (const f of files) {
    const d = f?.date ? new Date(f.date) : null;
    if (!d || isNaN(d.getTime())) continue;
    const h = d.getUTCHours();
    if (h >= 22 || h <= 4) n++;
  }
  return n;
}

function hourOf(nowMs) {
  return new Date(nowMs).getUTCHours();
}

// ─── BOARDS ────────────────────────────────────────────────────────────────

export const BOARDS = [
  {
    id: 'most_productive',
    title: 'Top 5 Most Productive',
    persona: 'productivite',
    peakHour: 11,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const work = countInUsage(usage, (a) => WORK_APPS.has(a));
      const creative = countInUsage(usage, isCreative);
      const ent = countInUsage(usage, (a) => ENTERTAINMENT_APPS.has(a));
      const baseline = work * 8 + creative * 6 - ent * 4;
      const d = decay(hourOf(nowMs), 11);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${work} work app(s), ${creative} creative app(s), ${ent} entertainment app(s) used recently.`,
      };
    },
  },
  {
    id: 'closest_to_burnout',
    title: 'Top 5 Closest to Burnout',
    persona: 'productivite',
    peakHour: 23,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const lateFiles = lateNightFileCount(data);
      const work = countInUsage(usage, (a) => WORK_APPS.has(a) || isCreative(a));
      const social = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const baseline = lateFiles * 10 + work * 3 - social * 2;
      const d = decay(hourOf(nowMs), 23);
      return {
        score: baseline * (1 + 0.4 * d),
        hint: `${lateFiles} late-night file edit(s), ${work} work app(s), ${social} social app(s).`,
      };
    },
  },
  {
    id: 'most_likely_change_jobs',
    title: 'Top 5 Most Likely to Change Jobs (30d)',
    persona: 'productivite',
    peakHour: 15,
    scoreFn: (data, _profile, nowMs) => {
      const urls = safeBrowserUrls(data);
      const jobs = urls.filter((u) => /linkedin\.com\/jobs|indeed\.com|glassdoor\.com|welcometothejungle/i.test(u)).length;
      const filesRecent = safeFiles(data).length;
      const usage = safeUsage(data);
      const comms = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const baseline = jobs * 15 + Math.max(0, 5 - filesRecent) * 3 + comms * 2;
      const d = decay(hourOf(nowMs), 15);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${jobs} job-board visit(s), ${filesRecent} recent file(s), ${comms} comms-app session(s).`,
      };
    },
  },
  {
    id: 'ignoring_health',
    title: 'Top 5 Most Likely Ignoring Health',
    persona: 'productivite',
    peakHour: 1,
    scoreFn: (data, _profile, nowMs) => {
      const installed = safeInstalled(data);
      const wifi = safeWifi(data);
      const cafeWifi = wifi.filter((w) => /caf[ée]|coffee/i.test(String(w))).length;
      const hasHealth = installed.some((a) => HEALTH_APPS.has(a));
      const lateFiles = lateNightFileCount(data);
      const baseline = lateFiles * 6 + cafeWifi * 4 + (hasHealth ? 0 : 10);
      const d = decay(hourOf(nowMs), 1);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${lateFiles} late-night file(s), ${cafeWifi} café wifi network(s), health app installed: ${hasHealth}.`,
      };
    },
  },
  {
    id: 'most_secure',
    title: 'Top 5 Most Secure',
    persona: 'securite',
    peakHour: 9,
    scoreFn: (data, _profile, nowMs) => {
      const installed = safeInstalled(data);
      const vpnCount = installed.filter((a) => VPN_APPS.has(a)).length;
      const torrentCount = installed.filter((a) => TORRENT_APPS.has(a)).length;
      const wifiCount = safeWifi(data).length;
      // Fewer wifi networks = less attack surface (deliberately reductive).
      const baseline = vpnCount * 30 + Math.max(0, 20 - wifiCount) - torrentCount * 25;
      const d = decay(hourOf(nowMs), 9);
      return {
        score: baseline * (1 + 0.2 * d),
        hint: `${vpnCount} VPN app(s), ${wifiCount} known wifi network(s), ${torrentCount} torrent app(s).`,
      };
    },
  },
  {
    id: 'most_socially_isolated',
    title: 'Top 5 Most Socially Isolated',
    persona: 'popularite',
    peakHour: 22,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const socialUse = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const wifiDiversity = new Set(safeWifi(data)).size;
      const baseline = Math.max(0, 25 - socialUse * 5) + Math.max(0, 6 - wifiDiversity) * 4;
      const d = decay(hourOf(nowMs), 22);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${socialUse} social-app session(s), ${wifiDiversity} unique wifi network(s).`,
      };
    },
  },
  {
    id: 'most_likely_ghost',
    title: 'Top 5 Most Likely to Ghost You',
    persona: 'popularite',
    peakHour: 20,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const comms = countInUsage(usage, (a) => COMMS_APPS.has(a));
      const total = usage.length;
      const nonCommsRatio = total > 0 ? (total - comms) / total : 1;
      const baseline = Math.max(0, 25 - comms * 4) + nonCommsRatio * 15;
      const d = decay(hourOf(nowMs), 20);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${comms} comms session(s) out of ${total} tracked app session(s).`,
      };
    },
  },
];
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run tests/leaderboards.test.js`
Expected: PASS — all board metadata + scoring assertions green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/leaderboards.js tests/leaderboards.test.js
git commit -m "feat(leaderboards): 7 board definitions with heuristic scoreFns"
```

---

## Task 3: `computeBoardStanding` — assemble a single board's top 5

**Files:**
- Modify: `server/lib/leaderboards.js`
- Modify: `tests/leaderboards.test.js`

- [ ] **Step 1: Write failing tests for `computeBoardStanding`**

Append to `tests/leaderboards.test.js`:

```js
import { computeBoardStanding } from '../server/lib/leaderboards.js';

describe('computeBoardStanding', () => {
  const data = {
    MACHINE_IDENTITY: { installed_apps: ['Cursor', 'Figma', 'NordVPN'] },
    PAST_HISTORY: {
      app_usage_7days: [
        { app: 'Cursor', last_used: '2026-05-25T10:00:00Z' },
        { app: 'Figma',  last_used: '2026-05-25T10:30:00Z' },
      ],
      recent_files_7days: [],
      browser_history: { chrome: [], safari: [] },
      wifi_history: ['Home'],
      recent_downloads: [],
    },
  };
  const profile = {
    firstName: 'Brikeld',
    lastName: 'Hoxha',
    account: 'brikeld',
    avatarUrl: '/uploads/profile.jpg',
  };
  const board = BOARDS.find((b) => b.id === 'most_productive');
  const nowMs = new Date('2026-05-25T11:00:00Z').getTime();

  it('returns 5 entries with ranks 1..5', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    expect(standing.entries).toHaveLength(5);
    expect(standing.entries.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('userRank points to the real user (matched by handle/displayName)', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    const userEntry = standing.entries.find((e) => e.rank === standing.userRank);
    expect(userEntry.name).toBe('Brikeld Hoxha');
    expect(userEntry.handle).toBe('@brikeld');
  });

  it('returns the hint string emitted by the board scoreFn', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    expect(typeof standing.hint).toBe('string');
    expect(standing.hint.length).toBeGreaterThan(0);
  });

  it('the 4 non-user entries all render as Alex Johnson', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    const clones = standing.entries.filter((e) => e.name === 'Alex Johnson');
    expect(clones).toHaveLength(4);
    for (const c of clones) {
      expect(c.handle).toBe('@AlexLaptop');
      expect(c.avatarSrc).toBe('/imgs/AlexP.png');
    }
  });

  it('sorts strictly by score desc (ties broken by stable order)', () => {
    const standing = computeBoardStanding(board, data, profile, nowMs);
    for (let i = 1; i < standing.entries.length; i++) {
      expect(standing.entries[i - 1].score).toBeGreaterThanOrEqual(standing.entries[i].score);
    }
  });

  it('falls back to a default display name when profile lacks names', () => {
    const standing = computeBoardStanding(board, data, {}, nowMs);
    const user = standing.entries.find((e) => e.handle === '@you');
    expect(user).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run tests/leaderboards.test.js -t computeBoardStanding`
Expected: FAIL — `computeBoardStanding` is not exported.

- [ ] **Step 3: Implement `computeBoardStanding`**

Append to `server/lib/leaderboards.js`:

```js
// ─── Standing assembly ────────────────────────────────────────────────────

function realUserIdentity(profile) {
  const first = String(profile?.firstName ?? '').trim();
  const last = String(profile?.lastName ?? '').trim();
  const account = String(profile?.account ?? '').trim();
  const displayName = [first, last].filter(Boolean).join(' ') || 'You';
  const handle = account ? `@${account}` : '@you';
  const initials = [first, last]
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'YO';
  return {
    displayName,
    handle,
    avatarSrc: profile?.avatarUrl ?? null,
    avatarInitials: initials,
  };
}

/**
 * @returns {{ entries: Array<{ rank, name, handle, avatarSrc, avatarInitials, score, isUser }>,
 *             userRank: number,
 *             hint: string }}
 */
export function computeBoardStanding(board, dataJson, profile, nowMs) {
  const userIdent = realUserIdentity(profile);
  const userResult = board.scoreFn(dataJson, profile, nowMs);

  const rows = [];

  rows.push({
    name: userIdent.displayName,
    handle: userIdent.handle,
    avatarSrc: userIdent.avatarSrc,
    avatarInitials: userIdent.avatarInitials,
    score: Number(userResult.score) || 0,
    isUser: true,
  });

  for (let i = 0; i < FAKE_CLONE_COUNT; i++) {
    rows.push({
      name: FAKE_CLONE_IDENTITY.displayName,
      handle: FAKE_CLONE_IDENTITY.handle,
      avatarSrc: FAKE_CLONE_IDENTITY.avatarSrc,
      avatarInitials: FAKE_CLONE_IDENTITY.avatarInitials,
      score: scoreCloneFor(board.id, i, nowMs),
      isUser: false,
    });
  }

  // Stable sort by score desc; preserves insertion order on ties so user beats clones at parity.
  rows.sort((a, b) => b.score - a.score);

  const entries = rows.map((r, i) => ({ rank: i + 1, ...r }));
  const userRank = entries.find((e) => e.isUser)?.rank ?? null;

  return { entries, userRank, hint: userResult.hint };
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run tests/leaderboards.test.js -t computeBoardStanding`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/leaderboards.js tests/leaderboards.test.js
git commit -m "feat(leaderboards): computeBoardStanding assembles top-5"
```

---

## Task 4: `pickBoardToPost` — diff against prior posts, pick highest delta

**Files:**
- Modify: `server/lib/leaderboards.js`
- Modify: `tests/leaderboards.test.js`

- [ ] **Step 1: Write failing tests for `pickBoardToPost`**

Append to `tests/leaderboards.test.js`:

```js
import { pickBoardToPost } from '../server/lib/leaderboards.js';

describe('pickBoardToPost', () => {
  const NOW = new Date('2026-05-25T11:00:00Z').getTime();
  const data = {
    MACHINE_IDENTITY: { installed_apps: ['Cursor', 'NordVPN'] },
    PAST_HISTORY: {
      app_usage_7days: [{ app: 'Cursor', last_used: '2026-05-25T10:00:00Z' }],
      recent_files_7days: [],
      browser_history: { chrome: [], safari: [] },
      wifi_history: ['Home'],
      recent_downloads: [],
    },
  };
  const profile = { firstName: 'Brikeld', lastName: 'Hoxha', account: 'brikeld' };

  it('returns a board choice when no prior leaderboard posts exist (first-ever appearance)', () => {
    const result = pickBoardToPost(data, profile, [], NOW);
    expect(result).not.toBeNull();
    expect(result.board).toBeTruthy();
    expect(result.standing.userRank).toBeGreaterThanOrEqual(1);
    expect(result.prevRank).toBeNull();
  });

  it('skips boards whose userRank matches the most recent post for that board', () => {
    const standingNow = (() => {
      const board = BOARDS.find((b) => b.id === 'most_productive');
      return computeBoardStanding(board, data, profile, NOW);
    })();

    // Build a "prior post" capturing the current rank for EVERY board, so no delta.
    const priorPosts = BOARDS.map((b) => {
      const s = computeBoardStanding(b, data, profile, NOW);
      return {
        createdAt: '2026-05-25T10:00:00Z',
        leaderboard: { boardId: b.id, userRank: s.userRank, entries: s.entries },
      };
    });

    const result = pickBoardToPost(data, profile, priorPosts, NOW);
    expect(result).toBeNull();
  });

  it('first-appearance counts as max delta (priority order breaks ties)', () => {
    // Prior posts cover the LAST 6 boards (locking them at their current rank); only
    // the first board (most_productive) is "new" → it should be chosen.
    const priorPosts = BOARDS.slice(1).map((b) => {
      const s = computeBoardStanding(b, data, profile, NOW);
      return {
        createdAt: '2026-05-25T10:00:00Z',
        leaderboard: { boardId: b.id, userRank: s.userRank, entries: s.entries },
      };
    });
    const result = pickBoardToPost(data, profile, priorPosts, NOW);
    expect(result).not.toBeNull();
    expect(result.board.id).toBe('most_productive');
    expect(result.prevRank).toBeNull();
  });

  it('ignores non-leaderboard posts when scanning prior state', () => {
    const priorPosts = [
      { createdAt: '2026-05-25T10:00:00Z', persona: 'productivite', content: 'normal post' },
      { createdAt: '2026-05-25T09:00:00Z', persona: 'securite', content: 'another' },
    ];
    const result = pickBoardToPost(data, profile, priorPosts, NOW);
    expect(result).not.toBeNull();
    expect(result.prevRank).toBeNull();
  });

  it('uses the MOST RECENT leaderboard post per board (first match in array)', () => {
    // posts/{id}.json is stored newest-first; the lookup must respect that ordering.
    const board = BOARDS.find((b) => b.id === 'most_productive');
    const currentStanding = computeBoardStanding(board, data, profile, NOW);

    const priorPosts = [
      // Newest → matches current rank → should suppress
      {
        createdAt: '2026-05-25T10:30:00Z',
        leaderboard: { boardId: 'most_productive', userRank: currentStanding.userRank, entries: [] },
      },
      // Older → different rank → must NOT be considered
      {
        createdAt: '2026-05-24T10:00:00Z',
        leaderboard: { boardId: 'most_productive', userRank: 5, entries: [] },
      },
    ];

    // Lock all OTHER boards at current rank so only most_productive is in play.
    const lockOthers = BOARDS.filter((b) => b.id !== 'most_productive').map((b) => {
      const s = computeBoardStanding(b, data, profile, NOW);
      return {
        createdAt: '2026-05-25T10:00:00Z',
        leaderboard: { boardId: b.id, userRank: s.userRank, entries: [] },
      };
    });

    const result = pickBoardToPost(data, profile, [...priorPosts, ...lockOthers], NOW);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run tests/leaderboards.test.js -t pickBoardToPost`
Expected: FAIL — `pickBoardToPost` is not exported.

- [ ] **Step 3: Implement `pickBoardToPost`**

Append to `server/lib/leaderboards.js`:

```js
// ─── Pick logic — diff current standings vs prior posts ───────────────────

const FIRST_APPEARANCE_DELTA = 5;

function priorRankByBoard(existingPosts) {
  // posts/{id}.json is newest-first; first hit per board wins.
  const out = {};
  if (!Array.isArray(existingPosts)) return out;
  for (const p of existingPosts) {
    const lb = p?.leaderboard;
    if (!lb || typeof lb.boardId !== 'string') continue;
    if (Object.prototype.hasOwnProperty.call(out, lb.boardId)) continue;
    const r = Number(lb.userRank);
    out[lb.boardId] = Number.isFinite(r) ? r : null;
  }
  return out;
}

/**
 * @returns {{ board, standing, prevRank: number|null } | null}
 *   null when nothing has changed since the last leaderboard post.
 */
export function pickBoardToPost(dataJson, profile, existingPosts, nowMs) {
  const priorByBoard = priorRankByBoard(existingPosts);

  let best = null; // { board, standing, prevRank, delta, priority }
  for (let i = 0; i < BOARDS.length; i++) {
    const board = BOARDS[i];
    const standing = computeBoardStanding(board, dataJson, profile, nowMs);
    const prev = Object.prototype.hasOwnProperty.call(priorByBoard, board.id)
      ? priorByBoard[board.id]
      : null;
    const delta = prev === null
      ? FIRST_APPEARANCE_DELTA
      : Math.abs((standing.userRank ?? 0) - prev);
    if (delta === 0) continue;

    if (
      best === null
      || delta > best.delta
      || (delta === best.delta && i < best.priority)
    ) {
      best = { board, standing, prevRank: prev, delta, priority: i };
    }
  }

  if (!best) return null;
  return { board: best.board, standing: best.standing, prevRank: best.prevRank };
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run tests/leaderboards.test.js`
Expected: PASS — all leaderboard tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/leaderboards.js tests/leaderboards.test.js
git commit -m "feat(leaderboards): pickBoardToPost selects max-delta board"
```

---

## Task 5: Leaderboard LLM prompt in `DEFAULT_SLOT_PROMPTS`

**Files:**
- Modify: `server/lib/prompts.js`
- Test: `tests/promptsLoader.test.js`

- [ ] **Step 1: Open the existing prompts test to confirm patterns**

Run: `cat tests/promptsLoader.test.js | head -40`
This is informational — note the existing assertion style; you'll follow it.

- [ ] **Step 2: Write a failing test for the new `leaderboard` slot prompt**

Append to `tests/promptsLoader.test.js`:

```js
import { DEFAULT_SLOT_PROMPTS, loadPrompts } from '../server/lib/prompts.js';

describe('DEFAULT_SLOT_PROMPTS.leaderboard', () => {
  it('declares system, temperature, maxTokens', () => {
    const p = DEFAULT_SLOT_PROMPTS.leaderboard;
    expect(p).toBeTruthy();
    expect(typeof p.system).toBe('string');
    expect(p.system.length).toBeGreaterThan(50);
    expect(typeof p.temperature).toBe('number');
    expect(typeof p.maxTokens).toBe('number');
  });

  it('loadPrompts merges leaderboard slot prompt with fallback when prompts.json omits it', async () => {
    // dataDir that has no prompts.json → fall back to defaults
    const prompts = await loadPrompts('/this/path/does/not/exist');
    expect(prompts.slotPrompts.leaderboard).toBeTruthy();
    expect(typeof prompts.slotPrompts.leaderboard.system).toBe('string');
  });
});
```

- [ ] **Step 3: Run the test, confirm it fails**

Run: `npx vitest run tests/promptsLoader.test.js -t leaderboard`
Expected: FAIL — `DEFAULT_SLOT_PROMPTS.leaderboard` is undefined.

- [ ] **Step 4: Add the new slot prompt**

Edit `server/lib/prompts.js`. Inside the `DEFAULT_SLOT_PROMPTS` object, after the `document:` entry, add:

```js
  leaderboard: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. The user has just been ranked on a top-5 leaderboard by an opaque scoring algorithm. The board title, the user's rank (1–5), and (optionally) their previous rank are listed in the context above. Write ONE post (max 200 chars) reacting to the rank or the change — confident, slightly self-aware, lean into the algorithm's reductive framing. If previousUserRank is provided, acknowledge the move (climbed / dropped / new). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.8,
    maxTokens: 1200,
  },
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npx vitest run tests/promptsLoader.test.js -t leaderboard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/prompts.js tests/promptsLoader.test.js
git commit -m "feat(prompts): add leaderboard slot prompt"
```

---

## Task 6: `buildLeaderboardSlot` + wire 4th slot into `generatePersonaPosts`

**Files:**
- Modify: `server/lib/personaPostGenerator.js`
- Test: `tests/personaPostGenerator.leaderboard.test.js` (new)

- [ ] **Step 1: Write a failing test that exercises the 4th slot and the null-skip path**

Create `tests/personaPostGenerator.leaderboard.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePersonaPosts } from '../server/lib/personaPostGenerator.js';
import { BOARDS, computeBoardStanding } from '../server/lib/leaderboards.js';

const NOW = new Date('2026-05-25T11:00:00Z').getTime();

const fakeData = {
  MACHINE_IDENTITY: { installed_apps: ['Cursor', 'NordVPN'] },
  PAST_HISTORY: {
    app_usage_7days: [{ app: 'Cursor', last_used: '2026-05-25T10:00:00Z' }],
    recent_files_7days: [],
    browser_history: { chrome: [], safari: [] },
    wifi_history: ['Home'],
    recent_downloads: [],
  },
};
const fakeProfile = { firstName: 'Brikeld', lastName: 'Hoxha', account: 'brikeld' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));

  // Stub the LM Studio HTTP call so we can run without a server.
  global.fetch = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    const isLeaderboardSlot = body.messages.some((m) =>
      typeof m.content === 'string' && m.content.includes('[Leaderboard slot]'),
    );
    const content = isLeaderboardSlot
      ? '{"content":"Climbed to #1 in Most Productive — algorithm calls it a high signal.","sentiment":"positive"}'
      : '{"content":"generic post","sentiment":"positive"}';
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
    };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('generatePersonaPosts — leaderboard slot', () => {
  it('returns 4 entries (text, asset, chart, leaderboard) when nothing is excluded', async () => {
    const results = await generatePersonaPosts({
      baseUrl: 'http://stub',
      model: 'test-model',
      userPayload: JSON.stringify({ user: {}, profile: fakeProfile }),
      timeoutMs: 1000,
      retries: 0,
      assetAssignment: null,
      prompts: null,
      dataJson: fakeData,
      profile: fakeProfile,
      existingPosts: [],
    });

    expect(results).toHaveLength(4);
    const leaderboardPost = results[3];
    expect(leaderboardPost).not.toBeNull();
    expect(leaderboardPost.leaderboard).toBeTruthy();
    expect(leaderboardPost.leaderboard.boardId).toMatch(/^most_/);
    expect(Array.isArray(leaderboardPost.leaderboard.entries)).toBe(true);
    expect(leaderboardPost.leaderboard.entries).toHaveLength(5);
    expect(leaderboardPost.leaderboard.userRank).toBeGreaterThanOrEqual(1);
    expect(leaderboardPost.leaderboard.userRank).toBeLessThanOrEqual(5);
  });

  it('returns null for the leaderboard slot when no board rank has changed', async () => {
    // Lock every board at its current rank via prior posts.
    const lockingPosts = BOARDS.map((b) => {
      const s = computeBoardStanding(b, fakeData, fakeProfile, NOW);
      return {
        createdAt: '2026-05-25T10:00:00Z',
        leaderboard: { boardId: b.id, userRank: s.userRank, entries: s.entries },
      };
    });

    const results = await generatePersonaPosts({
      baseUrl: 'http://stub',
      model: 'test-model',
      userPayload: JSON.stringify({ user: {}, profile: fakeProfile }),
      timeoutMs: 1000,
      retries: 0,
      assetAssignment: null,
      prompts: null,
      dataJson: fakeData,
      profile: fakeProfile,
      existingPosts: lockingPosts,
    });

    expect(results).toHaveLength(4);
    expect(results[3]).toBeNull();
  });

  it('the leaderboard post carries previousUserRank=null on first appearance', async () => {
    const results = await generatePersonaPosts({
      baseUrl: 'http://stub',
      model: 'test-model',
      userPayload: JSON.stringify({ user: {}, profile: fakeProfile }),
      timeoutMs: 1000,
      retries: 0,
      assetAssignment: null,
      prompts: null,
      dataJson: fakeData,
      profile: fakeProfile,
      existingPosts: [],
    });
    expect(results[3].leaderboard.previousUserRank).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run tests/personaPostGenerator.leaderboard.test.js`
Expected: FAIL — only 3 slot entries returned; no `results[3]`.

- [ ] **Step 3: Add `buildLeaderboardSlot` and wire it into `generatePersonaPosts`**

Edit `server/lib/personaPostGenerator.js`:

a) Near the top imports, add:

```js
import { pickBoardToPost } from './leaderboards.js';
```

b) After `buildAssetSlot()` (just before the `// ─── Slot runner ──` divider), add:

```js
function buildLeaderboardSlot(dataJson, profile, baseUserPayload, existingPosts, nowMs) {
  const pick = pickBoardToPost(dataJson, profile, existingPosts, nowMs);
  if (!pick) return null;

  const { board, standing, prevRank } = pick;
  const ctxLines = [
    '[Leaderboard slot]',
    `Board: ${board.title}`,
    `Your rank: ${standing.userRank}${prevRank != null ? ` (was ${prevRank})` : ' (new appearance)'}`,
    `Score signal hint: ${standing.hint}`,
  ];
  const ctx = ctxLines.join('\n');

  return {
    id: 'leaderboard',
    persona: board.persona,
    promptKey: 'leaderboard',
    userPayload: `${ctx}\n\n---\n${baseUserPayload}`,
    imageData: null,
    docText: null,
    docFilename: null,
    attachedAsset: null,
    leaderboard: {
      boardId: board.id,
      title: board.title,
      userRank: standing.userRank,
      previousUserRank: prevRank,
      entries: standing.entries.map((e) => ({
        rank: e.rank,
        name: e.name,
        handle: e.handle,
        avatarSrc: e.avatarSrc,
        avatarInitials: e.avatarInitials,
        score: e.score,
        isUser: e.isUser,
      })),
    },
  };
}
```

c) In `runSlot()`, just before the `return post;` line at the bottom, add:

```js
  if (slot.leaderboard) post.leaderboard = slot.leaderboard;
```

d) In `generatePersonaPosts()`, replace the slot-assembly block:

```js
  const personaScores = profile?.personaScores ? normalizePersonaPercentTriplet(profile.personaScores) : null;
  const [chartSlot, textSlot] = await Promise.all([
    buildChartSlot(dataJson, profile, userPayload, existingPosts, chartUploadDir, personaScores),
    Promise.resolve(buildTextSlot(dataJson, userPayload, existingPosts, SP, personaScores)),
  ]);
  const assetSlot = buildAssetSlot(userPayload, assetAssignment);

  const slots = [textSlot, assetSlot, chartSlot].map(s => ({ ...s, _model: model }));
```

…with:

```js
  const personaScores = profile?.personaScores ? normalizePersonaPercentTriplet(profile.personaScores) : null;
  const [chartSlot, textSlot] = await Promise.all([
    buildChartSlot(dataJson, profile, userPayload, existingPosts, chartUploadDir, personaScores),
    Promise.resolve(buildTextSlot(dataJson, userPayload, existingPosts, SP, personaScores)),
  ]);
  const assetSlot = buildAssetSlot(userPayload, assetAssignment);
  const leaderboardSlot = buildLeaderboardSlot(
    dataJson, profile, userPayload, existingPosts, Date.now(),
  );

  // leaderboardSlot may be null (no rank changed) → skipped silently.
  const slots = [textSlot, assetSlot, chartSlot, leaderboardSlot]
    .map((s, i) => (s ? { ...s, _model: model, _slotIndex: i } : null));
```

e) Update the parallel-map at the bottom of `generatePersonaPosts` so null slots resolve to null without calling LLM:

```js
  const results = new Array(slots.length).fill(null);

  await Promise.all(
    slots.map((slot, index) => {
      if (!slot) return Promise.resolve(null);  // <— added
      return runSlot(slot, { baseUrl, timeoutMs, retries, SP })
        .catch((err) => {
          console.error(`[personaPostGenerator] slot ${slot.id} failed:`, err?.message || err);
          return null;
        })
        .then(async (post) => {
          if (!post || !post.content) return null;
          results[index] = post;
          if (typeof onEachPost === 'function') {
            try {
              await Promise.resolve(onEachPost(post, { slotIndex: index }));
            } catch (e) {
              console.error('[personaPostGenerator] onEachPost failed:', e?.message || e);
            }
          }
          return post;
        });
    }),
  );

  return results;
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run tests/personaPostGenerator.leaderboard.test.js`
Expected: PASS — all three scenarios green.

- [ ] **Step 5: Run the whole vitest suite to confirm no regressions**

Run: `npm test`
Expected: PASS — all existing tests + the new ones.

- [ ] **Step 6: Commit**

```bash
git add server/lib/personaPostGenerator.js tests/personaPostGenerator.leaderboard.test.js
git commit -m "feat(generator): add 4th conditional leaderboard slot"
```

---

## Task 7: Streaming + batch route handle the 4th slot

The server route already loops over the slots returned by `generatePersonaPosts` and filters `Boolean`. We just need to verify nothing else makes a 3-slot assumption and to update the stream-side `bySlot` array length.

**Files:**
- Modify: `server-generate.js`

- [ ] **Step 1: Locate the hardcoded 3-slot array in the stream handler**

Run: `grep -n "new Array(3)" server-generate.js`
Expected: one hit on the line `const bySlot = new Array(3).fill(null);` in the `/api/posts/generate-stream` handler.

- [ ] **Step 2: Update the array length to 4**

Edit `server-generate.js`, replace:

```js
    const bySlot = new Array(3).fill(null);
```

with:

```js
    const bySlot = new Array(4).fill(null);
```

- [ ] **Step 3: Manual sanity check — the route filters null results**

Run: `grep -n "filter(Boolean)" server-generate.js`
Expected: hits inside `/api/posts/generate` and `/api/posts/generate-stream`. Confirms a null leaderboard slot is silently dropped — no additional changes needed.

- [ ] **Step 4: Commit**

```bash
git add server-generate.js
git commit -m "fix(server-generate): widen stream slot tracker to 4"
```

---

## Task 8: `LeaderboardBlock` React component + CSS

**Files:**
- Create: `src/features/feed/LeaderboardBlock.jsx`
- Create: `src/features/feed/leaderboardBlock.css`
- Test: `tests/leaderboardBlock.test.jsx` (new)

- [ ] **Step 1: Confirm vitest can transform JSX**

This is the first React-component test in the repo. `vite.config.js` already loads `@vitejs/plugin-react`, which Vitest reuses for transforms — so a `.test.jsx` file with `import React from 'react'`-style JSX should "just work" against the default node environment using `react-dom/server.renderToStaticMarkup` (no browser DOM needed).

If Step 5 below errors with something like `Failed to parse source ... Unexpected token <`, add a `vitest.config.js` next to `vite.config.js`:

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```
…then re-run Step 5.

- [ ] **Step 2: Write the failing test**

Create `tests/leaderboardBlock.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LeaderboardBlock from '../src/features/feed/LeaderboardBlock.jsx';

const sample = {
  boardId: 'most_productive',
  title: 'Top 5 Most Productive',
  userRank: 1,
  previousUserRank: 2,
  entries: [
    { rank: 1, name: 'Brikeld Hoxha', handle: '@brikeld',    avatarSrc: '/uploads/x.jpg', avatarInitials: 'BH', isUser: true,  score: 87 },
    { rank: 2, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 81 },
    { rank: 3, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 74 },
    { rank: 4, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 68 },
    { rank: 5, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 61 },
  ],
};

describe('<LeaderboardBlock>', () => {
  it('renders the board title', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    expect(html).toContain('Top 5 Most Productive');
  });

  it('renders 5 rows in rank order', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    const rowMatches = html.match(/leaderboard-row/g) || [];
    expect(rowMatches.length).toBe(5);
    // #1 appears before #5
    expect(html.indexOf('#1')).toBeLessThan(html.indexOf('#5'));
  });

  it('marks the user row with --self', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    expect(html).toContain('leaderboard-row--self');
  });

  it('renders a delta chip "▲ from #2" when previousUserRank > userRank', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    expect(html).toContain('from #2');
    expect(html).toContain('▲');
  });

  it('renders "NEW" chip when previousUserRank is null', () => {
    const html = renderToStaticMarkup(
      <LeaderboardBlock leaderboard={{ ...sample, previousUserRank: null }} accentColor="#abc" />,
    );
    expect(html).toContain('NEW');
  });

  it('does NOT render any score number anywhere', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    // Scores in sample: 87, 81, 74, 68, 61 — none must appear in markup
    for (const score of ['87', '81', '74', '68', '61']) {
      expect(html).not.toContain(`>${score}<`);
    }
  });

  it('renders all 4 Alex Johnson rows literally identical', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    const alexMatches = html.match(/Alex Johnson/g) || [];
    expect(alexMatches.length).toBe(4);
  });
});
```

- [ ] **Step 3: Run the test, confirm it fails**

Run: `npx vitest run tests/leaderboardBlock.test.jsx`
Expected: FAIL — module `src/features/feed/LeaderboardBlock.jsx` not found.

- [ ] **Step 4: Implement the component**

Create `src/features/feed/LeaderboardBlock.jsx`:

```jsx
import './leaderboardBlock.css';

function DeltaChip({ userRank, previousUserRank }) {
  if (previousUserRank == null) {
    return <span className="leaderboard-delta leaderboard-delta--new">NEW</span>;
  }
  if (previousUserRank === userRank) return null;
  const isUp = userRank < previousUserRank;
  return (
    <span
      className={`leaderboard-delta ${isUp ? 'leaderboard-delta--up' : 'leaderboard-delta--down'}`}
    >
      {isUp ? '▲' : '▼'} from #{previousUserRank}
    </span>
  );
}

function Row({ entry }) {
  const cls = `leaderboard-row${entry.isUser ? ' leaderboard-row--self' : ''}`;
  return (
    <li className={cls}>
      <span className="leaderboard-row__rank">#{entry.rank}</span>
      <span className="leaderboard-row__avatar" aria-hidden>
        {entry.avatarSrc
          ? <img className="leaderboard-row__avatar-img" src={entry.avatarSrc} alt="" />
          : <span className="leaderboard-row__avatar-initials">{entry.avatarInitials}</span>}
      </span>
      <span className="leaderboard-row__name">{entry.name}</span>
      <span className="leaderboard-row__handle">{entry.handle}</span>
    </li>
  );
}

export default function LeaderboardBlock({ leaderboard, accentColor }) {
  if (!leaderboard || !Array.isArray(leaderboard.entries)) return null;
  const { title, entries, userRank, previousUserRank } = leaderboard;

  return (
    <div
      className="post-attachment-block leaderboard-block"
      style={{ '--post-accent': accentColor }}
    >
      <header className="leaderboard-block__head">
        <h3 className="leaderboard-block__title">{title}</h3>
        <DeltaChip userRank={userRank} previousUserRank={previousUserRank} />
      </header>
      <ul className="leaderboard-block__rows">
        {entries.map((e) => <Row key={e.rank} entry={e} />)}
      </ul>
    </div>
  );
}
```

Create `src/features/feed/leaderboardBlock.css`:

```css
.leaderboard-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px 28px;
  border-radius: var(--radius-post-surface);
  background: var(--card);
  border: var(--capsule-shell-border-width) solid var(--border);
}

.leaderboard-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.leaderboard-block__title {
  font-family: var(--font-avant);
  font-weight: 600;
  font-size: 18px;
  letter-spacing: 0.02em;
  color: var(--ink);
  margin: 0;
}

.leaderboard-delta {
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--panel-muted);
  color: var(--ink);
  white-space: nowrap;
}
.leaderboard-delta--new { background: var(--post-accent, var(--card)); }
.leaderboard-delta--up  { background: var(--post-accent, var(--card)); }
.leaderboard-delta--down { background: var(--card); opacity: 0.85; }

.leaderboard-block__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leaderboard-row {
  display: grid;
  grid-template-columns: 38px 36px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: calc(var(--radius-post-surface) / 2);
  background: transparent;
  color: var(--ink);
  font-family: var(--font-avant);
}

.leaderboard-row--self {
  background: var(--post-accent, var(--panel-muted));
  border: 1px solid var(--border);
}

.leaderboard-row__rank {
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
}

.leaderboard-row__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--dot);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.leaderboard-row__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.leaderboard-row__avatar-initials {
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}

.leaderboard-row__name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--ink);
}

.leaderboard-row__handle {
  font-family: var(--font-avant-book-oblique);
  font-size: 11px;
  color: var(--muted);
  line-height: 1.2;
}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npx vitest run tests/leaderboardBlock.test.jsx`
Expected: PASS — title, 5 rows, --self class, delta chip, NEW chip, no scores, 4 Alexes.

- [ ] **Step 6: Commit**

```bash
git add src/features/feed/LeaderboardBlock.jsx src/features/feed/leaderboardBlock.css tests/leaderboardBlock.test.jsx
git commit -m "feat(feed): LeaderboardBlock component + styles"
```

---

## Task 9: PostCard branch — render `LeaderboardBlock` when present

**Files:**
- Modify: `src/features/feed/PostCard.jsx`
- Test: `tests/postCardLeaderboard.test.jsx` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/postCardLeaderboard.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PostCard from '../src/features/feed/PostCard.jsx';

const leaderboardPost = {
  id: 'p1',
  persona: 'productivite',
  content: 'Climbed to #1 in Most Productive.',
  displayName: 'Brikeld Hoxha',
  handle: '@brikeld',
  avatarInitials: 'BH',
  avatarSrc: '/uploads/x.jpg',
  noteColor: '#d8d8d8',
  createdAt: new Date().toISOString(),
  systemDeltaPct: 1,
  leaderboard: {
    boardId: 'most_productive',
    title: 'Top 5 Most Productive',
    userRank: 1,
    previousUserRank: 2,
    entries: [
      { rank: 1, name: 'Brikeld Hoxha', handle: '@brikeld',    avatarSrc: '/uploads/x.jpg', avatarInitials: 'BH', isUser: true,  score: 87 },
      { rank: 2, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 81 },
      { rank: 3, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 74 },
      { rank: 4, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 68 },
      { rank: 5, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 61 },
    ],
  },
};

describe('<PostCard> with leaderboard post', () => {
  it('renders the leaderboard block when post.leaderboard is set', () => {
    const html = renderToStaticMarkup(<PostCard post={leaderboardPost} />);
    expect(html).toContain('leaderboard-block');
    expect(html).toContain('Top 5 Most Productive');
  });

  it('does not break for a normal (non-leaderboard) post', () => {
    const html = renderToStaticMarkup(<PostCard post={{ ...leaderboardPost, leaderboard: undefined }} />);
    expect(html).not.toContain('leaderboard-block');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run tests/postCardLeaderboard.test.jsx`
Expected: FAIL — no `leaderboard-block` rendered.

- [ ] **Step 3: Add the import and branch in `PostCard.jsx`**

Edit `src/features/feed/PostCard.jsx`:

a) Add an import near the existing component imports (top of file, after `PostDocument`):

```jsx
import LeaderboardBlock from './LeaderboardBlock.jsx';
```

b) Destructure `leaderboard` from the post (extend the existing destructure block):

```jsx
  const {
    content,
    noteColor,
    displayName,
    handle,
    avatarInitials,
    avatarSrc,
    createdAt,
    systemDeltaPct = 1,
    persona,
    attachedAsset,
    chartType,
    leaderboard,           // <— added
  } = post;
```

c) Inside the `<div className="post-unified-capsule">` block, just AFTER the closing `)} : null}` for the `attachedAsset?.kind === 'document'` branch and BEFORE the `{showCommentsCapsule ? (` block, add:

```jsx
        {leaderboard ? (
          <LeaderboardBlock leaderboard={leaderboard} accentColor={noteColor} />
        ) : null}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run tests/postCardLeaderboard.test.jsx`
Expected: PASS — both assertions green.

- [ ] **Step 5: Run the full vitest suite**

Run: `npm test`
Expected: PASS — no regressions in any pre-existing test.

- [ ] **Step 6: Commit**

```bash
git add src/features/feed/PostCard.jsx tests/postCardLeaderboard.test.jsx
git commit -m "feat(feed): render LeaderboardBlock from PostCard"
```

---

## Task 10: Manual smoke test — end-to-end in the running app

**No new files.** Verify the feature works against the real generator + LM Studio.

- [ ] **Step 1: Start the data + generate servers**

Open a terminal in the repo root and run:
```bash
npm run servers
```
Expected: two log lines — `Data server running on http://localhost:3001` and `Generator server running on http://localhost:3010` plus an LM Studio line showing the configured base URL + model.

- [ ] **Step 2: Start the Vite dev server in a second terminal**

```bash
npm run dev
```
Expected: Vite prints a local URL (typically `http://localhost:5173`). Open it.

- [ ] **Step 3: Click "GENERATE NEW CONTENT" (or the equivalent button in the profile view)**

Expected:
- 3 or 4 new posts appear at the top of the feed within ~30s (depends on LM Studio latency).
- If a 4th post appears, scroll through the feed and confirm it has a `LeaderboardBlock` (a titled top-5 list with one row highlighted — the user's row — and a `NEW` chip top-right on the first run).

- [ ] **Step 4: Click "GENERATE NEW CONTENT" again immediately**

Expected:
- 3 new posts (text/asset/chart) appear.
- The 4th leaderboard slot likely returns null this run (every board's current rank matches what was just posted) → no 4th leaderboard post. This is the "no rank change" suppression path and is correct behavior.

- [ ] **Step 5: Wait at least 10 minutes, then click "GENERATE NEW CONTENT" again**

Expected:
- The clone-drift bucket has advanced; some boards' rankings may now differ. A 4th leaderboard post may appear with a `▲ from #N` or `▼ from #N` chip showing the rank change.

- [ ] **Step 6: Inspect the on-disk JSON to verify shape**

Run: `cat posts/$(ls profiles | head -1 | sed 's/.json//').json | head -120`
Expected: the most recent leaderboard post entry includes a `"leaderboard"` field with `boardId`, `title`, `userRank`, `previousUserRank`, and `entries: [5]` — and the entries include `score` numbers (used internally, not rendered).

- [ ] **Step 7: Verify the suppression invariant by deleting and regenerating**

Run: `mv posts/$(ls profiles | head -1 | sed 's/.json//').json /tmp/posts-backup.json`
Then click "GENERATE NEW CONTENT" once. Expected: 4 posts, including a leaderboard post with `previousUserRank: null` (first appearance again).

Restore: `mv /tmp/posts-backup.json posts/$(ls profiles | head -1 | sed 's/.json//').json` (if you want your prior feed back).

- [ ] **Step 8: If everything checks out, commit any incidental changes**

```bash
git status
```
Expected: working tree clean (no incidental changes). If there are uncommitted changes from manual testing, review and either discard or commit deliberately.

---

## Notes on first-run fan-out

On a brand-new profile, all 7 boards are first appearances (`delta = 5`). Because we cap leaderboard posts at **one per run**, only the highest-priority board (`most_productive`) fires on run 1. Subsequent runs cover the remaining boards one at a time — exactly as designed. This is not a bug; it's the suppression rule keeping the feed clean.

## Notes on clone drift cadence

`CLONE_DRIFT_BUCKET_MS = 10 minutes` is intentionally short for demo perceptibility. If the demo runs leave too much churn (4th post fires on nearly every click), bump to `30 * 60 * 1000` (30 min) in `server/lib/leaderboards.js`. No other code change needed.
