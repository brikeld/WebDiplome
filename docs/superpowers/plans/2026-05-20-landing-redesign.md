# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `LandingPage.jsx` + `landingPage.css` from scratch — white background, black text, 5 × 100vh screens, persona colors restricted to profile preview and persona-explanation cards only.

**Architecture:** Two files are fully replaced. `landingPage.css` defines all layout and style tokens for the white theme. `LandingPage.jsx` composes 5 100vh `<section>` elements; a local `ProfileHeaderPreview` helper renders the demo profile header in both Screen 2 and Screen 5 to avoid duplication.

**Tech Stack:** React 18, Vite, plain CSS (no preprocessor), `var(--font-avant)` from `src/styles/base.css`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/landing-page/landingPage.css` | Full rewrite | All layout, spacing, typography, card styles for the white theme |
| `src/landing-page/LandingPage.jsx` | Full rewrite | 5 screens + local `ProfileHeaderPreview` helper + data arrays |

No other files change.

---

## Task 1: Rewrite `landingPage.css`

**Files:**
- Rewrite: `src/landing-page/landingPage.css`

There are no unit tests for CSS. Visual verification is in Task 3.

- [ ] **Step 1: Replace `landingPage.css` with the complete white-theme stylesheet**

```css
/* Landing page — white theme, 5 × 100vh screens. Fully self-contained. */

.lp-root {
  --lp-edge-pad: clamp(20px, 5vw, 64px);
  --lp-card-radius: 24px;
  --lp-card-border: 2px solid #000;
  --lp-mega: clamp(48px, 6vw, 90px);
  --lp-hero-size: clamp(96px, 18vw, 560px);
  --lp-sub-size: clamp(48px, 6.5vw, 96px);

  width: 100%;
  min-height: 100vh;
  background: #fff;
  color: #000;
  font-family: var(--font-avant);
  overflow-x: hidden;
}

/* ── ANIMATIONS ──────────────────────────────────────────────────────────── */

@keyframes lp-fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── TOPBAR ──────────────────────────────────────────────────────────────── */

.lp-topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 12px var(--lp-edge-pad);
  position: sticky;
  top: 0;
  z-index: 50;
  background: transparent;
}

.lp-topbar-debug {
  appearance: none;
  background: transparent;
  border: none;
  color: rgba(0, 0, 0, 0.35);
  font-family: var(--font-avant);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  cursor: pointer;
  padding: 0;
}

.lp-topbar-debug:hover {
  color: #000;
}

/* ── BASE SCREEN ─────────────────────────────────────────────────────────── */

.lp-screen {
  height: 100vh;
  box-sizing: border-box;
  padding: clamp(28px, 4vh, 56px) var(--lp-edge-pad);
  opacity: 0;
  animation: lp-fade-up 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  animation-delay: calc(var(--stagger-i, 0) * 0.09s);
}

/* ── SCREEN 1: HERO ──────────────────────────────────────────────────────── */

.lp-hero {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-left: 0;
  padding-right: 0;
  padding-top: 0;
}

.lp-hero-title {
  font-size: var(--lp-hero-size);
  font-weight: 800;
  line-height: 0.88;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  color: #000;
  white-space: nowrap;
  display: block;
  width: 100%;
  text-align: center;
  margin: 0;
  padding: 0;
}

.lp-hero-text {
  padding: 0 var(--lp-edge-pad) clamp(28px, 5vh, 64px);
}

.lp-hero-sub {
  font-size: var(--lp-sub-size);
  font-weight: 700;
  line-height: 0.95;
  letter-spacing: -0.025em;
  color: #000;
  margin: 0;
}

.lp-hero-sub em {
  font-style: italic;
}

/* ── SHARED: SCREEN TITLE (screens 3, 4, 5) ─────────────────────────────── */

.lp-screen-title {
  font-size: var(--lp-mega);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  color: #000;
  margin: 0 0 clamp(20px, 3vh, 40px) 0;
  flex-shrink: 0;
}

/* ── SHARED: CARDS ROW (3-column) ────────────────────────────────────────── */

.lp-cards-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  flex: 1 1 auto;
  min-height: 0;
}

/* ── SHARED: STEP CARD (workflow — white + black border) ─────────────────── */

.lp-step-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px 24px;
  border-radius: var(--lp-card-radius);
  border: var(--lp-card-border);
  background: #fff;
  color: #000;
  box-sizing: border-box;
  overflow: hidden;
}

.lp-step-num {
  font-size: clamp(44px, 5.5vw, 68px);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.05em;
  color: rgba(0, 0, 0, 0.12);
}

.lp-step-title {
  font-size: clamp(18px, 2vw, 26px);
  font-weight: 800;
  letter-spacing: -0.015em;
  color: #000;
  margin: 0;
}

.lp-step-body {
  font-size: clamp(13px, 1.4vw, 16px);
  font-weight: 500;
  line-height: 1.55;
  color: #000;
  flex: 1 1 auto;
  margin: 0;
}

.lp-step-foot {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.4);
  margin-top: auto;
}

/* ── SHARED: PERSONA CARD (colored fill) ─────────────────────────────────── */

.lp-persona-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px 24px;
  border-radius: var(--lp-card-radius);
  background: var(--persona-card-color, #D8D8D8);
  color: #000;
  box-sizing: border-box;
  overflow: hidden;
}

/* ── SCREEN 2: PROFILE + DOWNLOAD ────────────────────────────────────────── */

.lp-profile-screen {
  display: grid;
  grid-template-columns: 55fr 45fr;
  gap: 16px;
  align-items: stretch;
}

.lp-profile-col-left {
  border: var(--lp-card-border);
  border-radius: var(--lp-card-radius);
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.lp-profile-col-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lp-desc-card {
  flex: 1 1 auto;
  border: var(--lp-card-border);
  border-radius: var(--lp-card-radius);
  padding: 28px 32px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
}

.lp-desc-card-text {
  font-size: clamp(18px, 1.8vw, 24px);
  font-weight: 500;
  line-height: 1.55;
  color: #000;
  margin: 0;
}

.lp-download-card {
  flex-shrink: 0;
  border: var(--lp-card-border);
  border-radius: var(--lp-card-radius);
  padding: 22px 26px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 18px;
}

.lp-download-card-info {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.lp-download-title {
  font-size: clamp(18px, 2vw, 26px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.05;
  margin: 0;
}

.lp-download-sub {
  font-size: clamp(13px, 1.3vw, 16px);
  font-weight: 500;
  margin: 0;
}

.lp-download-fine {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  color: rgba(0, 0, 0, 0.45);
  margin: 0;
}

.lp-app-icon {
  width: clamp(70px, 7.5vw, 96px);
  height: clamp(70px, 7.5vw, 96px);
  flex-shrink: 0;
  border: var(--lp-card-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.4);
  padding: 8px;
  box-sizing: border-box;
  line-height: 1.4;
}

/* ── SCREEN 3: WORKFLOW ───────────────────────────────────────────────────── */

.lp-workflow-screen {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* ── SCREEN 4: PERSONAS ───────────────────────────────────────────────────── */

.lp-personas-screen {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* ── SCREEN 5: SUMMARY ────────────────────────────────────────────────────── */

.lp-summary-screen {
  display: flex;
  flex-direction: column;
}

.lp-summary-body {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 40fr 60fr;
  gap: 16px;
}

.lp-summary-profile-card {
  border: var(--lp-card-border);
  border-radius: var(--lp-card-radius);
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
}

.lp-summary-right {
  display: grid;
  grid-template-rows: 1fr 1fr auto;
  gap: 12px;
  min-height: 0;
}

.lp-summary-mini-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  min-height: 0;
}

.lp-summary-mini-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 16px;
  border: var(--lp-card-border);
  background: #fff;
  color: #000;
  box-sizing: border-box;
  overflow: hidden;
}

.lp-summary-mini-card--persona {
  background: var(--persona-card-color, #D8D8D8);
  border: none;
}

.lp-summary-mini-num {
  font-size: clamp(20px, 2.5vw, 32px);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: rgba(0, 0, 0, 0.12);
}

.lp-summary-mini-title {
  font-size: clamp(10px, 1vw, 13px);
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-summary-download-row {
  display: flex;
  gap: 12px;
  align-items: stretch;
  flex-shrink: 0;
}

.lp-summary-download-info {
  flex: 1 1 auto;
  border: var(--lp-card-border);
  border-radius: 16px;
  padding: 14px 18px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.lp-summary-download-title {
  font-size: clamp(13px, 1.3vw, 16px);
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0;
}

.lp-summary-download-fine {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  color: rgba(0, 0, 0, 0.45);
  margin: 0;
}

.lp-summary-app-icon {
  width: clamp(52px, 5.5vw, 72px);
  flex-shrink: 0;
  border: var(--lp-card-border);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.4);
  padding: 6px;
  box-sizing: border-box;
  line-height: 1.4;
}

/* ── RESPONSIVE ───────────────────────────────────────────────────────────── */

@media (max-width: 900px) {
  .lp-hero-title {
    font-size: clamp(56px, 18vw, 120px);
    white-space: normal;
  }

  .lp-profile-screen {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 100vh;
  }

  .lp-cards-row,
  .lp-summary-mini-row {
    grid-template-columns: 1fr;
  }

  .lp-summary-body {
    grid-template-columns: 1fr;
    height: auto;
  }

  .lp-summary-right {
    grid-template-rows: auto auto auto;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/landing-page/landingPage.css
git commit -m "feat(landing): rewrite CSS — white theme, 5-screen layout"
```

---

## Task 2: Rewrite `LandingPage.jsx` — data, helpers, Screens 1 & 2

**Files:**
- Rewrite: `src/landing-page/LandingPage.jsx`

- [ ] **Step 1: Replace `LandingPage.jsx` with the full file below**

This includes all data arrays, the `ProfileHeaderPreview` helper, and all 5 screens in one pass.

```jsx
import PostCard from '../features/feed/PostCard.jsx';
import './landingPage.css';

const PERSONAS = [
  {
    key: 'productivity',
    color: '#D8D8D8',
    title: 'Productivity',
    body: "We count your idle minutes so you don't have to. Distraction is now a measurable failure — congratulations, the hours you wasted are public, indexed, and dated.",
    foot: 'axis 01 of 03 · weighted · no appeals',
  },
  {
    key: 'security',
    color: '#759AEF',
    title: 'Security',
    body: 'Your "summer2019" password? We saw. We told 47,000 strangers. You\'re welcome — transparency is how trust is built, one leaked credential at a time.',
    foot: 'axis 02 of 03 · weighted · no appeals',
  },
  {
    key: 'popularity',
    color: '#CCF847',
    title: 'Social',
    body: "Silence is data. Isolation is data. We tally every group chat you went quiet in. The algorithm thinks you should call your mother — also, your mother thinks so.",
    foot: 'axis 03 of 03 · weighted · no appeals',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Install. Surrender.',
    body: "The collector deploys silently — exactly the way good software should. It reads every process, keystroke, and connection so you don't have to remember what you did. Browser history, shell, sleep cycles, networks — all backed up. For convenience.",
    foot: 'step 01 of 03 · entirely optional · also mandatory',
  },
  {
    n: '02',
    title: 'Process. Be judged.',
    body: 'Your patterns become a posture. Your posture becomes a verdict. The model resolves your entire digital existence into a tidy number between 0 and 100. Finally — an answer to the question "but what kind of person am I?"',
    foot: 'step 02 of 03 · entirely optional · also mandatory',
  },
  {
    n: '03',
    title: 'Publish. Smile.',
    body: 'Your file goes public. Score, posts, badges — all visible. Strangers will read it. Recruiters will read it. Your ex will read it. The score updates without notice, because surprises are fun.',
    foot: 'step 03 of 03 · entirely optional · also mandatory',
  },
];

const DEMO_POSTS = [
  {
    id: 'dp-1',
    persona: 'productivite',
    color: '#D8D8D8',
    name: 'Alex Johnson',
    handle: '@demo_machine',
    content: 'Resumed work 03:14. Closed 47 tabs. Reopened 19. Productivity penalty applied. Subject was disappointed — we were too.',
    delta: '-2',
    time: '4m',
  },
  {
    id: 'dp-2',
    persona: 'securite',
    color: '#759AEF',
    name: 'Alex Johnson',
    handle: '@demo_machine',
    content: 'Webcam active during off-hours. 14 facial expressions classified as guilt. Logged automatically.',
    delta: '-9',
    time: '21m',
    attachment: {
      type: 'photo',
      url: '/uploads/deb273de2bce06fbccb2c0bd07b889a77af5163f37302840855afa6593976548.jpg',
      caption: 'frame_0047 · subject flagged · auto-captured',
    },
  },
  {
    id: 'dp-4',
    persona: 'popularite',
    color: '#CCF847',
    name: 'Alex Johnson',
    handle: '@demo_machine',
    content: 'Group chat silent for 6 days. Read 11 messages. Replied to 0. We respect that.',
    delta: '-4',
    time: '6d',
  },
];

function timeToCreatedAt(timeStr) {
  const m = String(timeStr).match(/^(\d+)([mhd])$/);
  if (!m) return new Date();
  const ms = { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
  return new Date(Date.now() - parseInt(m[1]) * ms);
}

function ProfileHeaderPreview() {
  return (
    <div style={{ '--persona-accent': '#759AEF', '--tabs-capsule-fill': '#c5d4f8' }}>
      <div className="profile-header-stack">
        <div className="profile-hero-capsule">
          <div className="profile-cap-avatar" aria-hidden style={{ '--cap-avatar-stroke': '#759AEF' }}>
            <img className="profile-cap-avatar-img" src="/imgs/AlexP.png" alt="" />
          </div>
          <div className="profile-hero-main">
            <div className="profile-hero-left">
              <div className="profile-name-handle-stack">
                <div className="profile-name-row">
                  <div className="profile-name-lg">Alex Johnson</div>
                </div>
                <div className="profile-handle-row">
                  <div className="profile-handle-lg">@demo_machine</div>
                  <button
                    type="button"
                    className="profile-connect-btn"
                    style={{ color: '#759AEF' }}
                  >
                    connect
                  </button>
                </div>
              </div>
              <div className="profile-follow-row">
                <span className="profile-follow-item">
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-7 9a7 7 0 0 1 14 0H2z" />
                    <path d="M13 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm1 9a7 7 0 0 0-2-4.9A5 5 0 0 1 19 15h-5z" />
                  </svg>
                  <span className="profile-follow-num">412</span>
                </span>
                <span className="profile-follow-item">
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M10 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 2.02-8 4.5V17h16v-1.5c0-2.48-3.58-4.5-8-4.5z" />
                  </svg>
                  <span className="profile-follow-num">38</span>
                </span>
              </div>
              <p className="profile-bio">
                Subject observed for 412 days without interruption. 9,184 events logged this week.
                Behavior is consistent — perhaps disturbingly so.
              </p>
            </div>
          </div>
        </div>
        <div
          className="profile-badge-capsule"
          style={{
            borderColor: '#759AEF',
            background: 'color-mix(in srgb, #759AEF 15%, #fff)',
          }}
        >
          <div className="profile-badge-circle" style={{ background: '#759AEF' }} />
          <div className="profile-badge-circle" style={{ background: '#759AEF' }} />
          <div className="profile-badge-circle" style={{ background: '#759AEF' }} />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onEnterDemo }) {
  return (
    <div className="lp-root">
      <header className="lp-topbar">
        <button
          type="button"
          className="lp-topbar-debug"
          onClick={() => onEnterDemo?.()}
          title="developer shortcut — enter feed without enrolling"
        >
          debug
        </button>
      </header>

      <main>

        {/* ── SCREEN 1: HERO ── */}
        <section className="lp-screen lp-hero" style={{ '--stagger-i': 0 }}>
          <h1 className="lp-hero-title">COMPLIANT</h1>
          <div className="lp-hero-text">
            <h2 className="lp-hero-sub">
              Who are you really?
              <br />
              <em>Let our algorithm answer that for you.</em>
            </h2>
          </div>
        </section>

        {/* ── SCREEN 2: PROFILE + DOWNLOAD ── */}
        <section className="lp-screen lp-profile-screen" style={{ '--stagger-i': 1 }}>
          <div className="lp-profile-col-left">
            <ProfileHeaderPreview />
            <div>
              {DEMO_POSTS.map((post) => (
                <PostCard
                  key={post.id}
                  hidePills
                  post={{
                    noteColor: post.color,
                    displayName: post.name,
                    handle: post.handle,
                    content: post.content,
                    createdAt: timeToCreatedAt(post.time),
                    systemDeltaPct: Math.abs(parseInt(post.delta, 10)),
                    persona: post.persona,
                    avatarSrc: '/imgs/AlexP.png',
                    attachment: post.attachment?.type === 'photo' ? {
                      url: post.attachment.url,
                      filename: post.attachment.caption || '',
                    } : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="lp-profile-col-right">
            <div className="lp-desc-card">
              <p className="lp-desc-card-text">
                What other subjects will see when the script finishes its first sweep of your machine.
                Yours will be similar. Probably worse.
              </p>
            </div>
            <div className="lp-download-card">
              <div className="lp-download-card-info">
                <p className="lp-download-title">Download Compliant</p>
                <p className="lp-download-sub">Let the process begin</p>
                <p className="lp-download-fine">Compliant.dmg · macOS · zero refunds</p>
              </div>
              <div className="lp-app-icon">icon app,{' '}coming soon</div>
            </div>
          </div>
        </section>

        {/* ── SCREEN 3: WORKFLOW ── */}
        <section className="lp-screen lp-workflow-screen" style={{ '--stagger-i': 2 }}>
          <h2 className="lp-screen-title">workflow in 3 parts.</h2>
          <div className="lp-cards-row">
            {STEPS.map((s) => (
              <article key={s.n} className="lp-step-card">
                <span className="lp-step-num">{s.n}</span>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-body">{s.body}</p>
                <p className="lp-step-foot">{s.foot}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── SCREEN 4: PERSONAS ── */}
        <section className="lp-screen lp-personas-screen" style={{ '--stagger-i': 3 }}>
          <h2 className="lp-screen-title">the 3 personas.</h2>
          <div className="lp-cards-row">
            {PERSONAS.map((p, i) => (
              <article
                key={p.key}
                className="lp-persona-card"
                style={{ '--persona-card-color': p.color }}
              >
                <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="lp-step-title">{p.title}</h3>
                <p className="lp-step-body">{p.body}</p>
                <p className="lp-step-foot">{p.foot}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── SCREEN 5: SUMMARY ── */}
        <section className="lp-screen lp-summary-screen" style={{ '--stagger-i': 4 }}>
          <h2 className="lp-screen-title">screen resume of everything.</h2>
          <div className="lp-summary-body">

            <div className="lp-summary-profile-card">
              <ProfileHeaderPreview />
            </div>

            <div className="lp-summary-right">
              <div className="lp-summary-mini-row">
                {STEPS.map((s) => (
                  <div key={s.n} className="lp-summary-mini-card">
                    <span className="lp-summary-mini-num">{s.n}</span>
                    <p className="lp-summary-mini-title">{s.title}</p>
                  </div>
                ))}
              </div>

              <div className="lp-summary-mini-row">
                {PERSONAS.map((p, i) => (
                  <div
                    key={p.key}
                    className="lp-summary-mini-card lp-summary-mini-card--persona"
                    style={{ '--persona-card-color': p.color }}
                  >
                    <span className="lp-summary-mini-num">{String(i + 1).padStart(2, '0')}</span>
                    <p className="lp-summary-mini-title">{p.title}</p>
                  </div>
                ))}
              </div>

              <div className="lp-summary-download-row">
                <div className="lp-summary-download-info">
                  <p className="lp-summary-download-title">Download Compliant</p>
                  <p className="lp-summary-download-fine">Compliant.dmg · macOS · zero refunds</p>
                </div>
                <div className="lp-summary-app-icon">icon app,{' '}coming soon</div>
              </div>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/landing-page/LandingPage.jsx
git commit -m "feat(landing): rewrite JSX — 5-screen white layout"
```

---

## Task 3: Visual verification

**Files:** none — read-only verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:5173` (or whichever port Vite reports) in a browser. The landing page is shown when no profile is loaded.

- [ ] **Step 2: Verify Screen 1**

Expected:
- White background
- "COMPLIANT" solid black, full-width, centered, huge
- "Who are you really? / *Let our algorithm answer that for you.*" at the bottom-left, black text, italic on the second line
- No gradient, no persona colors
- Debug button top-right, faint black

- [ ] **Step 3: Scroll to Screen 2**

Expected:
- Two columns: left = bordered card containing Alex Johnson profile header + 3 demo posts (persona colors active — avatar ring blue, post accents per persona)
- Right top = bordered card with description text in black
- Right bottom = bordered card with "Download Compliant / Let the process begin / Compliant.dmg…" + small "icon app, coming soon" box

- [ ] **Step 4: Scroll to Screen 3**

Expected:
- "workflow in 3 parts." title, black, large
- 3 cards below with black borders, white background, step numbers (faint), titles, body text, footer

- [ ] **Step 5: Scroll to Screen 4**

Expected:
- "the 3 personas." title, black
- 3 cards filled with persona colors (#D8D8D8 / #759AEF / #CCF847), black text

- [ ] **Step 6: Scroll to Screen 5**

Expected:
- "screen resume of everything." title
- Left: bordered card with Alex Johnson profile header only (no posts), persona colors active
- Right: 2 rows of mini cards (workflow white-bordered top, persona-colored bottom) + download row at bottom

- [ ] **Step 7: Commit verification note**

If all screens look correct:

```bash
git commit --allow-empty -m "chore: visual verification passed — landing redesign complete"
```

If any screen has issues, fix them in `LandingPage.jsx` or `landingPage.css` and commit the fix before marking this task done.
