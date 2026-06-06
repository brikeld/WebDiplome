const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const THEMES = {
  prod: { className: "theme-prod", accent: "#d8d8d8", pastel: "#eeeeee", label: "Productivity" },
  sec: { className: "theme-sec", accent: "#759aef", pastel: "#bccdf5", label: "Security" },
  soc: { className: "theme-soc", accent: "#ccf847", pastel: "#ebf8b7", label: "Social" },
};

const SECTIONS = [
  {
    title: "Normal posts",
    states: [
      {
        id: "normal-idle",
        title: "Idle shimmer",
        status: "Collapsed · waiting",
        mode: "idle",
        notes: [
          ["ok", "Idle tell strip while a regular post is highlighted — productivity persona capsule."],
          ["info", "← → arrow keys (or Prev/Next) step through all showcase states."],
          ["warn", "Timer row is hidden in this showcase — tell capsule only."],
        ],
      },
      {
        id: "normal",
        title: "Analysis panel",
        status: "np2 layout",
        mode: "expanded",
        panel: "normal",
        notes: [
          ["ok", "Regular posts: quote + Thinking / Ingredients / From data to post."],
          ["info", "Tap chips inside the preview to open detail strips — does not change the rail state."],
          ["warn", "Some posts (e.g. WiFi-only slices) ship without ingredients — this example uses a chart post with full analysis."],
        ],
      },
      {
        id: "normal-previous",
        title: "Previous analysis",
        status: "old np2",
        mode: "expanded",
        panel: "normalPrevious",
        notes: [
          ["ok", "Original normal-post visualization kept here for direct comparison."],
          ["info", "Uses the same real post and the same analysis data as the simplified version."],
          ["warn", "This is only for comparison inside this standalone showcase."],
        ],
      },
    ],
  },
  {
    title: "Leaderboard posts",
    states: [
      {
        id: "leaderboard-idle",
        title: "Idle shimmer",
        status: "Collapsed · waiting",
        theme: "prod",
        mode: "idle",
        notes: [
          ["ok", "Idle tell strip while a leaderboard post is highlighted — productivity persona capsule."],
          ["info", "Expand and close play automatically when stepping between idle and panel states."],
          ["warn", "Accent follows the highlighted post persona, not profile dominant."],
        ],
      },
      {
        id: "leaderboard",
        title: "Rank rationale",
        status: "lb2 main",
        theme: "prod",
        mode: "expanded",
        panel: "leaderboard",
        notes: [
          ["ok", "Leaderboard posts use lb2: rank, verdict, climb tip, signal grid."],
          ["info", "Tap signal chips or OTHER USERS inside the preview — rail stays on this state."],
          ["warn", "Accent follows the highlighted post persona, not profile dominant."],
        ],
      },
    ],
  },
];

const STATES = SECTIONS.flatMap((section) => section.states);

const EXPAND_LOADING_MS = 1200;
const CLOSE_MS = 220;

// Showcase copy sourced from generated posts in posts_personas.json (Electron data dir).

/** @see post id 4b9e996a-36ff-4001-aa15-db1f6098d3df — productivite / app_categories chart */
const NORMAL_POST = {
  personaKicker: "productivity persona",
  content:
    "Feeling like my workflow is 90% Adobe and AI right now. That Creative category dominates the usage stats.",
  highlightPhrase: "Creative category dominates the usage stats",
  highlightIngredientIndex: 1,
};

const THINKING = [
  { label: "FOCUS SET", detail: "I noticed the Creative category is tied with Dev & Work, which suggests a heavy creative-technical blend." },
  { label: "AI WEIGHT", detail: "The presence of 6 AI Tools alongside heavy Adobe use makes sense for this persona." },
  { label: "POST CHOICE", detail: "I decided to focus the post on the dominance of the creative side rather than just the raw numbers." },
];

const INGREDIENTS = [
  {
    label: "Installed Apps Distribution",
    weight: 85,
    points: [
      "17 in Other",
      "12 in Creative",
      "12 in Dev & Work",
      "6 in AI Tools",
      "5 in Entertainment",
      "2 in Social",
      "2 in Security",
    ],
  },
  {
    label: "Creative Software Usage",
    weight: 90,
    points: [
      "Adobe Photoshop 2025",
      "Adobe After Effects 2025",
      "Adobe Illustrator 2025",
      "Adobe InDesign 2026",
      "Adobe Lightroom CC",
    ],
  },
  {
    label: "Recent File Activity",
    weight: 70,
    points: [
      "assets modified on 2026-06-05 17:39",
      "design-showcase modified on 2026-06-03 17:49",
      "tokens.css modified on 2026-06-02 22:12",
    ],
  },
];

const CHAIN = [
  {
    label: "DATA",
    value: "The application usage shows a high concentration in 'Creative' with 12 out of 59 installed apps falling into that group.",
    source: "App Categories",
  },
  { label: "CLASSIFY", value: "Workflow focus", conf: "high" },
  {
    label: "INFER",
    value: "The user is heavily invested in visual design and media creation, which dictates the current digital activity.",
    conf: "low",
    bias: "This assumes all creative apps are equally important, ignoring potential development work.",
  },
];

/** @see post id fb2f2d32-413a-421c-862a-70a91980b8aa — most_productive leaderboard */
const LEADERBOARD = {
  userRank: 1,
  totalRanks: 5,
  verdict: "Your work sessions dominated the trace. The system saw output before it saw anything else.",
  boardDesc: "Ranks recent work-app activity against time spent in entertainment apps.",
  climbTip: "You are #1 on this board — keep doing what the algorithm already likes.",
};

const SIMPLE_CHAIN = [
  {
    label: "What we checked",
    value: "App groups: 12 Creative apps, 12 Work apps, 6 AI tools.",
    detail: "The post starts from simple activity signals: which apps are installed and which files changed recently.",
    tag: "app activity",
  },
  {
    label: "What it means",
    value: "Your recent activity looks strongly creative.",
    detail: "Creative tools and work tools both appear often, so the post focuses on a creative work pattern.",
    tag: "strong match",
  },
  {
    label: "Why this post",
    value: "The post talks about creative work because that was the clearest signal.",
    detail: "This is a guess based on recent data. It may miss context, but it explains why this post was written.",
    tag: "simple reason",
  },
];

const SIMPLE_RANK_CHAIN = [
  {
    label: "What we checked",
    value: "Work apps were active and entertainment apps were not.",
    detail: "The rank uses recent app activity. Work apps help. Entertainment apps lower the score.",
    tag: "ranking data",
  },
  {
    label: "What it means",
    value: "Your activity looked more work-focused than the other users.",
    detail: "The system compared your signals with the other people on this board.",
    tag: "comparison",
  },
  {
    label: "Why this rank",
    value: "You are #1 because your work score is the strongest right now.",
    detail: "The rank can change when your activity changes or when other users get stronger signals.",
    tag: "current rank",
  },
];

const SIGNALS = [
  {
    label: "5 work apps",
    examples: "Xcode · Figma · Notion",
    detail: "Work-classified app sessions are the primary positive signal. Each one bumps you up.",
    detected: ["Xcode", "Figma", "Notion"],
  },
  {
    label: "5 creative apps",
    examples: "Blender · Adobe Photoshop · DaVinci Resolve",
    detail: "Creative tools count as work-adjacent — a smaller bonus per session.",
    detected: ["Blender", "Adobe Photoshop", "DaVinci Resolve"],
  },
  {
    label: "0 entertainment apps used recently",
    examples: "VLC · Stremio",
    detail: "Entertainment time subtracts. The algorithm doesn't care that it's how you decompress.",
    detected: ["VLC", "Stremio"],
  },
];

const OTHERS = [
  { rank: 2, score: "score 74", hidden: false, quote: "quietly outproducing the room", name: "T. Müller" },
  { rank: 3, score: "score 39", hidden: false, quote: "mostly creative tools today", name: "R. Chen" },
  { rank: 4, score: "score 38", hidden: false, quote: "late-night work bursts", name: "M. Laurent" },
  { rank: 5, score: "score 34", hidden: false, quote: "one big push, then silence", name: "S. Park" },
];

let currentIndex = 0;
let currentTheme = "prod";
let playTimer = null;
let panelUi = freshPanelUi();
let transitionTimer = null;
let transitionGen = 0;

function freshPanelUi() {
  return {
    activeThinking: null,
    activeIngredient: null,
    activeChainStep: null,
    activeSignal: null,
    showOthers: false,
  };
}

function pillStyle(themeKey = currentTheme) {
  const theme = THEMES[themeKey] ?? THEMES.sec;
  return `--tell-pill-accent: ${theme.accent}; --tell-pill-pastel: ${theme.pastel}; --lb-acc: ${theme.accent}; --persona-accent: ${theme.accent}`;
}

function stateThemeKey(state) {
  return state.theme || currentTheme;
}

function tellLoadingMarkup(compact = true) {
  const bars = compact
    ? ['<div class="tell-load__skel"></div>', '<div class="tell-load__skel"></div>', '<div class="tell-load__skel tell-load__skel--solid"></div>']
    : [
        '<div class="tell-load__skel" style="height:22%"></div>',
        '<div class="tell-load__skel" style="height:18%"></div>',
        '<div class="tell-load__skel" style="height:42%"></div>',
        '<div class="tell-load__skel tell-load__skel--solid" style="height:12%"></div>',
      ];
  return `<div class="tell-load tell-load--loop${compact ? " tell-load--compact" : ""}" aria-hidden="true">${bars.join("")}</div>`;
}

function idlePulseMarkup(themeKey) {
  const theme = THEMES[themeKey] ?? THEMES.sec;
  return `
    <div class="tell-idle-a" style="${pillStyle(themeKey)}">
      <div class="tell-idle-a__top">
        <span class="tell-idle-a__persona">${theme.label} post</span>
        <span class="tell-idle-a__dots" aria-hidden="true">
          <i></i><i></i><i></i>
        </span>
      </div>
      <div class="tell-idle-a__bars" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="tell-idle-a__cta">
        <span>Tell me why</span>
        <b>→</b>
      </div>
    </div>
  `;
}

function getSectionMeta(index) {
  let cursor = 0;
  for (const section of SECTIONS) {
    const end = cursor + section.states.length;
    if (index >= cursor && index < end) {
      return {
        section,
        sectionIndex: index - cursor,
        startIndex: cursor,
        length: section.states.length,
      };
    }
    cursor = end;
  }
  return { section: SECTIONS[0], sectionIndex: 0, startIndex: 0, length: SECTIONS[0].states.length };
}

function stepState(delta) {
  showState(currentIndex + delta);
}

function idleTellMarkup(themeKey) {
  return `
    <div class="dashboard-tell-row" id="tellRow">
      <div class="tell-more-pill tell-more-pill--idle" style="${pillStyle(themeKey)}" role="status" aria-label="Tell me more loading">
        ${idlePulseMarkup(themeKey)}
      </div>
    </div>
  `;
}

function expandedTellShell({ closing = false, themeKey }) {
  return `
    <div class="dashboard-tell-row" id="tellRow">
      <div class="tell-more-pill tell-more-pill--expanded${closing ? " tell-more-pill--closing" : ""}" style="${pillStyle(themeKey)}" role="region" aria-label="Inference chain analysis">
        <div id="tellPanel" class="tell-panel-host"></div>
      </div>
    </div>
  `;
}

function loadingPanelMarkup() {
  return `
    <div class="inference-panel is-ready" role="region" aria-label="Tell me more analysis">
      ${tellLoadingMarkup(false)}
    </div>
  `;
}

function normalPanelMarkup() {
  const { activeThinking, activeIngredient, activeChainStep } = panelUi;
  const quoteParts = NORMAL_POST.content.split(NORMAL_POST.highlightPhrase);
  const quoteBefore = quoteParts[0] ?? "";
  const quoteAfter = quoteParts.slice(1).join(NORMAL_POST.highlightPhrase);

  return `
    <div class="tell-panel-a inference-panel is-ready" role="region" aria-label="Tell me more analysis">
      <div class="post-quote-a">
        <span class="panel-a__head">Why this post?</span>
        <p class="post-quote-a__text">${quoteBefore}<button type="button" class="post-quote-a__highlight" data-showcase-interactive data-chip-kind="ingredient" data-chip-index="${NORMAL_POST.highlightIngredientIndex}">${NORMAL_POST.highlightPhrase}</button>${quoteAfter}</p>
      </div>

      <section class="tape-section" aria-label="From data to post">
        <header class="panel-a__head">From data to post</header>
        <div class="tape">
          ${SIMPLE_CHAIN.map((item, i) => `
            <div class="tape__row">
              <div class="tape__step">
                <div class="tape__badge">${i + 1}</div>
                ${i < SIMPLE_CHAIN.length - 1 ? '<div class="tape__line"></div>' : ""}
              </div>
              <button type="button" class="tape__content${activeChainStep === i ? " is-open" : ""}" data-showcase-interactive data-chip-kind="chain" data-chip-index="${i}">
                <span class="tape__label">${item.label}</span>
                ${activeChainStep === i ? `<span class="tape__value">${item.value}</span><span class="tape__detail">${item.detail}<span class="tape__meta"><span class="tape__tag">${item.tag}</span></span></span>` : ""}
              </button>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="reason-section">
        <header class="panel-a__head">Why this angle</header>
        <div class="reason-chips">
          ${THINKING.map(
            (item, i) => `
              <button type="button" class="reason-chip${activeThinking === i ? " is-open" : ""}" data-showcase-interactive data-chip-kind="thinking" data-chip-index="${i}">
                ${item.label}
              </button>
            `,
          ).join("")}
        </div>
        ${
          activeThinking !== null
            ? `<div class="panel-a__detail">
                <span class="panel-a__detail-label">${THINKING[activeThinking].label}</span>
                <p>${THINKING[activeThinking].detail}</p>
              </div>`
            : ""
        }
      </section>

        ${
          INGREDIENTS.length
            ? `<section class="ing-section">
          <header class="panel-a__head">Data used</header>
          <div class="ing-bars">
            ${INGREDIENTS.map(
              (item, i) => `
                <button type="button" class="ing-bar__row${activeIngredient === i ? " is-open" : ""}" data-showcase-interactive data-chip-kind="ingredient" data-chip-index="${i}">
                  <span class="ing-bar__label">${item.label}</span>
                  <span class="ing-bar__track"><span class="ing-bar__fill" style="width:${item.weight}%"></span></span>
                  <span class="ing-bar__pct">${item.weight}%</span>
                </button>
              `,
            ).join("")}
          </div>
          ${
            activeIngredient !== null
              ? `<div class="panel-a__detail">
                  <b>${INGREDIENTS[activeIngredient].label}</b>
                  <ul>
                    ${INGREDIENTS[activeIngredient].points.map((p) => `<li>${p}</li>`).join("")}
                  </ul>
                </div>`
              : ""
          }
        </section>`
            : ""
        }
    </div>
  `;
}

function previousNormalPanelMarkup() {
  const { activeThinking, activeIngredient, activeChainStep } = panelUi;
  const quoteParts = NORMAL_POST.content.split(NORMAL_POST.highlightPhrase);
  const quoteBefore = quoteParts[0] ?? "";
  const quoteAfter = quoteParts.slice(1).join(NORMAL_POST.highlightPhrase);

  return `
    <div class="inference-panel is-ready" role="region" aria-label="Tell me more previous analysis">
      <div class="np2">
        <div class="np2__quote">
          <span class="np2__kicker">${NORMAL_POST.personaKicker}</span>
          <div class="inference-panel__post-quote">
            <p class="inference-panel__post-text">${quoteBefore}<button type="button" class="inference-panel__highlight" data-showcase-interactive data-chip-kind="ingredient" data-chip-index="${NORMAL_POST.highlightIngredientIndex}">${NORMAL_POST.highlightPhrase}</button>${quoteAfter}</p>
          </div>
        </div>

        <section class="np2__tile np2__tile--thinking">
          <header class="np2__tile-head">
            <span class="np2__label">THINKING PROCESS</span>
            <span class="np2__label np2__label--hint">tap to read</span>
          </header>
          <div class="np2__chip-grid">
            ${THINKING.map(
              (item, i) => `
                <button type="button" class="np2__chip${activeThinking === i ? " is-active" : ""}" data-showcase-interactive data-chip-kind="thinking" data-chip-index="${i}">
                  <span class="np2__chip-text">${item.label}</span>
                </button>
              `,
            ).join("")}
          </div>
          ${
            activeThinking !== null
              ? `<div class="np2__detail np2__detail--enter"><span class="np2__label">${THINKING[activeThinking].label}</span><p class="np2__detail-value">${THINKING[activeThinking].detail}</p></div>`
              : ""
          }
        </section>

        <section class="np2__tile np2__tile--ingredients">
          <header class="np2__tile-head">
            <span class="np2__label">INGREDIENTS</span>
            <span class="np2__label np2__label--hint">what fed the post</span>
          </header>
          <div class="np2__chip-grid">
            ${INGREDIENTS.map(
              (item, i) => `
                <button type="button" class="np2__chip np2__chip--weighted${activeIngredient === i ? " is-active" : ""}" data-showcase-interactive data-chip-kind="ingredient" data-chip-index="${i}">
                  <span class="np2__chip-mark">${item.weight}%</span>
                  <span class="np2__chip-text">${item.label}</span>
                </button>
              `,
            ).join("")}
          </div>
          ${
            activeIngredient !== null
              ? `<div class="np2__detail np2__detail--enter">
                  <span class="np2__label">${INGREDIENTS[activeIngredient].label.toUpperCase()}</span>
                  <ul class="np2__detail-list">
                    ${INGREDIENTS[activeIngredient].points.map((p) => `<li class="np2__detail-item">${p}</li>`).join("")}
                  </ul>
                </div>`
              : ""
          }
        </section>

        <section class="np2__tile np2__tile--chain">
          <header class="np2__tile-head">
            <span class="np2__label">FROM DATA TO POST</span>
            <span class="np2__label np2__label--hint">step by step</span>
          </header>
          <div class="np2__chip-grid np2__chip-grid--chain">
            ${CHAIN.map(
              (item, i) => `
                <button type="button" class="np2__chip np2__chip--chain${activeChainStep === i ? " is-active" : ""}" data-showcase-interactive data-chip-kind="chain" data-chip-index="${i}">
                  <span class="np2__chip-mark np2__chip-mark--chain">${i + 1}</span>
                  <span class="np2__chip-text">${item.label}</span>
                </button>
              `,
            ).join("")}
          </div>
          ${
            activeChainStep !== null
              ? `<div class="np2__detail np2__detail--enter">
                  <span class="np2__label">${CHAIN[activeChainStep].label}</span>
                  <p class="np2__detail-value">${CHAIN[activeChainStep].value}</p>
                  ${CHAIN[activeChainStep].source ? `<p class="np2__detail-meta"><span class="np2__detail-meta-tag">source</span><span>${CHAIN[activeChainStep].source}</span></p>` : ""}
                  ${CHAIN[activeChainStep].conf ? `<p class="np2__detail-meta"><span class="np2__detail-meta-tag">confidence</span><span>${CHAIN[activeChainStep].conf}</span></p>` : ""}
                  ${CHAIN[activeChainStep].bias ? `<p class="np2__detail-bias">${CHAIN[activeChainStep].bias}</p>` : ""}
                </div>`
              : ""
          }
        </section>
      </div>
    </div>
  `;
}

function leaderboardPanelMarkup() {
  const { activeSignal, showOthers } = panelUi;
  return `
    <div class="inference-panel inference-panel--leaderboard is-ready" role="region" aria-label="Tell me more analysis">
      <div class="inference-panel__body">
        <div class="lb2 is-ready">
          <div class="lb2__screen lb2__screen--main${showOthers ? " is-gone" : ""}">
            <div class="lb2__tile lb2__tile--rank">
              <span class="lb2__rank-label">RANK</span>
              <span class="lb2__rank-value">#${LEADERBOARD.userRank}</span>
              <span class="lb2__rank-of">of ${LEADERBOARD.totalRanks}</span>
            </div>
            <div class="lb2__tile lb2__tile--verdict">
              <div class="lb2__head"><span class="lb2__label">WHY THE SYSTEM</span></div>
              <p class="lb2__value">${LEADERBOARD.verdict}</p>
              <p class="lb2__value lb2__value--small">${LEADERBOARD.boardDesc}</p>
            </div>
            <div class="lb2__tile lb2__tile--improve">
              <div class="lb2__head"><span class="lb2__label">HOW CAN YOU IMPROVE</span></div>
              <p class="lb2__value lb2__value--climb">${LEADERBOARD.climbTip}</p>
            </div>
            <div class="lb2__tile lb2__tile--signals">
              <div class="lb2__head"><span class="lb2__label">WHAT COUNTED</span></div>
              <div class="lb2__sig-wrap">
                <div class="lb2__sig-grid">
                  ${SIGNALS.map(
                    (sig, i) => `
                      <button type="button" class="lb2__sig lb2__sig--named${activeSignal === i ? " is-active" : ""}" data-showcase-interactive data-chip-kind="signal" data-chip-index="${i}">
                        <span class="lb2__sig-copy">
                          <span class="lb2__sig-text">${sig.label}</span>
                          <span class="lb2__sig-examples">${sig.examples}</span>
                        </span>
                      </button>
                    `,
                  ).join("")}
                </div>
                ${
                  activeSignal !== null
                    ? `<div class="lb2__sig-detail lb2__detail--enter">
                        <div class="lb2__sig-detail-block">
                          <span class="lb2__label">WHY IT COUNTED</span>
                          <p class="lb2__value lb2__value--reason">${SIGNALS[activeSignal].detail}</p>
                        </div>
                        <div class="lb2__sig-detail-block">
                          <span class="lb2__label">DETECTED</span>
                          <ul class="lb2__sig-example-list">
                            ${SIGNALS[activeSignal].detected.map((item) => `<li class="lb2__sig-example-item">${item}</li>`).join("")}
                          </ul>
                        </div>
                      </div>`
                    : ""
                }
              </div>
            </div>
            <button type="button" class="lb2__cta" data-showcase-interactive data-action="others-open"><span>OTHER USERS</span><span class="lb2__cta-arrow">→</span></button>
          </div>

          <div class="lb2__screen lb2__screen--others${showOthers ? " is-active" : ""}">
            <div class="lb2__others-head">
              <button type="button" class="lb2__back" data-showcase-interactive data-action="others-back">← BACK</button>
              <span class="lb2__label lb2__label--head">OTHER USERS</span>
            </div>
            <ol class="lb2__others-list">
              ${OTHERS.map(
                (entry) => `
                  <li class="lb2__other${entry.hidden ? " is-hidden" : ""}">
                    <div class="lb2__other-meta">
                      <span class="lb2__other-rank">#${entry.rank}</span>
                      ${entry.hidden ? "" : `<span class="lb2__other-score">${entry.score}</span>`}
                    </div>
                    <div class="lb2__other-body">
                      <div class="lb2__other-portrait">
                        <span class="lb2__other-avatar${entry.hidden ? " lb2__other-avatar--hidden" : ""}" aria-hidden="true">
                          <span class="lb2__other-avatar-mock"></span>
                        </span>
                      </div>
                      ${
                        entry.hidden
                          ? `<p class="lb2__other-phrase">position hidden</p>`
                          : `<blockquote class="lb2__other-quote"><p class="lb2__other-quote-text">${entry.quote}</p></blockquote><cite class="lb2__other-cite">${entry.name}</cite>`
                      }
                    </div>
                  </li>
                `,
              ).join("")}
            </ol>
          </div>
        </div>
      </div>
    </div>
  `;
}

function clearTransitionTimers() {
  window.clearTimeout(transitionTimer);
  transitionTimer = null;
}

function panelHtmlForState(state) {
  if (state.panel === "normal") return normalPanelMarkup();
  if (state.panel === "normalPrevious") return previousNormalPanelMarkup();
  if (state.panel === "loading") return loadingPanelMarkup();
  if (state.panel === "leaderboard") return leaderboardPanelMarkup();
  return loadingPanelMarkup();
}

function ensureCapsuleShell() {
  let capsule = $("#capsule");
  if (capsule) return capsule;

  $("#capsuleHost").innerHTML = `
    <div class="dashboard-capsule dashboard-capsule--figma dashboard-capsule--tell-only" id="capsule" data-mode="idle">
      ${idleTellMarkup(currentTheme)}
    </div>
  `;
  return $("#capsule");
}

function applyCapsuleClasses(state) {
  const capsule = ensureCapsuleShell();
  const expanded = state.mode === "expanded" || state.mode === "closing";
  const closing = state.mode === "closing";

  capsule.dataset.mode = state.mode;
  capsule.classList.toggle("is-tell-expanded", expanded);
  capsule.classList.toggle("is-tell-closing", closing);
  capsule.classList.toggle("is-tell-idle", state.mode === "idle");
  capsule.style.cssText = pillStyle(stateThemeKey(state));
}

function renderTellRow(state, { panelEnter = false, panelOverride = null } = {}) {
  const themeKey = stateThemeKey(state);
  const panelKind = panelOverride ?? state.panel;
  ensureCapsuleShell();
  let tellRow = $("#tellRow");

  if (state.mode === "idle") {
    if (tellRow?.querySelector(".tell-more-pill--idle")) {
      tellRow.querySelector(".tell-more-pill--idle").style.cssText = pillStyle(themeKey);
      return;
    }
    const temp = document.createElement("div");
    temp.innerHTML = idleTellMarkup(themeKey);
    tellRow?.replaceWith(temp.firstElementChild);
    return;
  }

  const closing = state.mode === "closing";

  if (!tellRow?.querySelector(".tell-more-pill--expanded")) {
    const temp = document.createElement("div");
    temp.innerHTML = expandedTellShell({ closing, themeKey });
    tellRow?.replaceWith(temp.firstElementChild);
  } else {
    const pill = tellRow.querySelector(".tell-more-pill--expanded");
    pill.classList.toggle("tell-more-pill--closing", closing);
    pill.style.cssText = pillStyle(themeKey);
  }

  if (closing || panelKind === null) return;

  const panel = $("#tellPanel");
  if (!panel) return;
  panel.innerHTML = panelHtmlForState({ ...state, panel: panelKind });
  if (panelEnter) {
    panel.classList.remove("tell-panel-host--enter");
    void panel.offsetWidth;
    panel.classList.add("tell-panel-host--enter");
  }
}

function applyTheme(theme) {
  currentTheme = theme;
  document.body.className = THEMES[theme].className;
  $$(".themeswitch button").forEach((button) => {
    button.classList.toggle("is-on", button.dataset.theme === theme);
  });
}

function buildRail() {
  const rail = $("#rail");
  rail.innerHTML = "";
  let globalIndex = 0;

  SECTIONS.forEach((section) => {
    rail.insertAdjacentHTML(
      "beforeend",
      `<div class="rail__section"><div class="rail__section-title">${section.title}</div></div>`,
    );
    section.states.forEach((state, sectionIndex) => {
      const index = globalIndex;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "navitem";
      button.dataset.state = state.id;
      button.dataset.index = String(index);
      button.innerHTML = `
        <span class="navitem__n">${String(sectionIndex).padStart(2, "0")}</span>
        <span class="navitem__t">${state.title}</span>
        <span class="navitem__s">${state.status}</span>
      `;
      button.addEventListener("click", () => showState(index));
      rail.appendChild(button);
      globalIndex += 1;
    });
  });
}

function buildNotes(state) {
  $("#notes").innerHTML = `
    <div class="notes__title">Notes · tell behavior</div>
    <div class="notes__screen">${state.title}</div>
    ${state.notes
      .map(([type, text]) => {
        const mark = type === "ok" ? "✓" : type === "warn" ? "▲" : "◦";
        return `<div class="note note--${type}"><span class="note__mk">${mark}</span><span>${text}</span></div>`;
      })
      .join("")}
  `;
}

function updateChrome(state) {
  const meta = getSectionMeta(currentIndex);
  const canStep = STATES.length > 1;
  const stepLabel = `${String(currentIndex + 1).padStart(2, "0")}/${String(STATES.length).padStart(2, "0")}`;
  $("#frameMeta").textContent = `${stepLabel} · ${state.status} · ${meta.section.title}`;
  $("#prevState").disabled = !canStep;
  $("#nextState").disabled = !canStep;
  $("#playSequence").disabled = !canStep;
  $$(".navitem").forEach((button) => {
    button.classList.toggle("is-on", Number(button.dataset.index) === currentIndex);
  });
  buildNotes(state);
}

function nudgeHost() {
  const host = $("#capsuleHost");
  host.classList.remove("is-advancing");
  void host.offsetWidth;
  host.classList.add("is-advancing");
  window.setTimeout(() => host.classList.remove("is-advancing"), 380);
}

function commitStateVisual(state, { panelEnter = false, panelOverride = null } = {}) {
  applyCapsuleClasses(state);
  renderTellRow(state, { panelEnter, panelOverride });
}

function runExpandTransition(state, gen) {
  commitStateVisual({ ...state, mode: "expanded" }, { panelEnter: true, panelOverride: "loading" });
  nudgeHost();

  transitionTimer = window.setTimeout(() => {
    if (gen !== transitionGen) return;
    commitStateVisual(state, { panelEnter: true });
  }, EXPAND_LOADING_MS);
}

function runCloseTransition(state, prevState, gen) {
  commitStateVisual({ ...prevState, mode: "closing" }, { panelOverride: null });
  nudgeHost();

  transitionTimer = window.setTimeout(() => {
    if (gen !== transitionGen) return;
    commitStateVisual(state);
  }, CLOSE_MS);
}

function refreshPanel({ animate = true } = {}) {
  const state = STATES[currentIndex];
  if (state.mode === "idle") return;
  renderTellRow(state, { panelEnter: animate });
}

function showState(index, { keepPlaying = false } = {}) {
  if (!keepPlaying) window.clearTimeout(playTimer);
  clearTransitionTimers();
  transitionGen += 1;
  const gen = transitionGen;

  const prevState = STATES[currentIndex];
  currentIndex = (index + STATES.length) % STATES.length;
  const state = STATES[currentIndex];

  if (prevState?.panel !== state.panel || prevState?.mode === "idle" || state.mode === "idle") {
    panelUi = freshPanelUi();
  }

  applyTheme(stateThemeKey(state));
  updateChrome(state);

  const goingExpanded = prevState?.mode === "idle" && state.mode === "expanded";
  const goingIdle = prevState?.mode === "expanded" && state.mode === "idle";
  const swappingExpanded = prevState?.mode === "expanded" && state.mode === "expanded" && prevState !== state;

  if (goingExpanded) {
    runExpandTransition(state, gen);
    return;
  }

  if (goingIdle) {
    runCloseTransition(state, prevState, gen);
    return;
  }

  if (swappingExpanded) {
    panelUi = freshPanelUi();
    commitStateVisual(state, { panelEnter: true });
    nudgeHost();
    return;
  }

  commitStateVisual(state, { panelEnter: prevState !== state });
  if (prevState !== state) nudgeHost();
}

function toggleChip(kind, index) {
  if (kind === "thinking") {
    panelUi.activeThinking = panelUi.activeThinking === index ? null : index;
  } else if (kind === "ingredient") {
    panelUi.activeIngredient = panelUi.activeIngredient === index ? null : index;
  } else if (kind === "chain") {
    panelUi.activeChainStep = panelUi.activeChainStep === index ? null : index;
  } else if (kind === "signal") {
    panelUi.activeSignal = panelUi.activeSignal === index ? null : index;
  }
  refreshPanel({ animate: true });
}

function handleCapsuleClick(event) {
  const interactive = event.target.closest("[data-showcase-interactive]");
  if (!interactive) return;

  event.stopPropagation();

  const action = interactive.dataset.action;
  if (action === "others-open") {
    panelUi.showOthers = true;
    refreshPanel({ animate: true });
    return;
  }
  if (action === "others-back") {
    panelUi.showOthers = false;
    panelUi.activeSignal = null;
    refreshPanel({ animate: true });
    return;
  }

  const kind = interactive.dataset.chipKind;
  const index = Number(interactive.dataset.chipIndex);
  if (kind && Number.isFinite(index)) {
    toggleChip(kind, index);
  }
}

function playFlow() {
  if (STATES.length <= 1) return;

  const prevIndex = currentIndex;
  const nextIndex = (prevIndex + 1) % STATES.length;
  const prev = STATES[prevIndex];
  const next = STATES[nextIndex];

  showState(nextIndex, { keepPlaying: true });

  let delay = 3200;
  if (prev.mode === "idle" && next.mode === "expanded") delay = EXPAND_LOADING_MS + 2800;
  else if (prev.mode === "expanded" && next.mode === "idle") delay = CLOSE_MS + 2800;

  playTimer = window.setTimeout(playFlow, delay);
}

buildRail();
showState(0);

$("#prevState").addEventListener("click", () => stepState(-1));
$("#nextState").addEventListener("click", () => stepState(1));
$("#playSequence").addEventListener("click", () => playFlow());
$("#capsuleHost").addEventListener("click", handleCapsuleClick);

document.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  event.preventDefault();
  stepState(event.key === "ArrowRight" ? 1 : -1);
});

$$(".themeswitch button").forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.theme);
    applyCapsuleClasses(STATES[currentIndex]);
    renderTellRow(STATES[currentIndex]);
  });
});
