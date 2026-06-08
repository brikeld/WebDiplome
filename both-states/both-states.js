const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const THEMES = {
  prod: { className: "theme-prod", accent: "#d8d8d8", pastel: "#eeeeee", label: "Productivity" },
  sec: { className: "theme-sec", accent: "#759aef", pastel: "#bccdf5", label: "Security" },
  soc: { className: "theme-soc", accent: "#ccf847", pastel: "#ebf8b7", label: "Social" },
};

const EXPAND_LOADING_MS = 1200;
const CLOSE_MS = 480;

const NORMAL_POST = {
  content:
    "Feeling like my workflow is 90% Adobe and AI right now. That Creative category dominates the usage stats.",
  highlightPhrase: "Creative category dominates the usage stats",
  highlightIngredientIndex: 1,
};

const THINKING = [
  { label: "Focus set", detail: "I noticed the Creative category is tied with Dev & Work, which suggests a heavy creative-technical blend." },
  { label: "AI weight", detail: "The presence of 6 AI Tools alongside heavy Adobe use makes sense for this persona." },
  { label: "Post choice", detail: "I decided to focus the post on the dominance of the creative side rather than just the raw numbers." },
];

const INGREDIENTS = [
  {
    label: "Installed Apps Distribution",
    weight: 85,
    points: ["17 in Other", "12 in Creative", "12 in Dev & Work", "6 in AI Tools", "5 in Entertainment", "2 in Social", "2 in Security"],
  },
  {
    label: "Creative Software Usage",
    weight: 90,
    points: ["Adobe Photoshop 2025", "Adobe After Effects 2025", "Adobe Illustrator 2025", "Adobe InDesign 2026", "Adobe Lightroom CC"],
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

const HARVEST_PHRASES = [
  "Reading wallpaper pixels",
  "Scanning recent downloads",
  "Indexing open applications",
  "Mapping filesystem traces",
  "Capturing screen habits",
  "Profiling keyboard tempo",
  "Harvesting browser tabs",
  "Measuring idle gaps",
];

const TIMER_STATES = [
  { id: "pulse", title: "Timer pulse", status: "Default / ready", render: () => idleTimerMarkup("00:04", "dashboard-timer-card--countdown-pulse") },
  { id: "harvesting", title: "Harvesting", status: "Desktop collector", render: () => harvestMarkup() },
  { id: "scores", title: "Score update", status: "Persona deltas", render: () => scoreUpdateMarkup() },
  { id: "generating", title: "Generating content", status: "LM Studio posts", render: () => generatingMarkup() },
];

const GENERATING_KEYS = ["productivity", "security", "social"];
const GENERATING_COLORS = { productivity: "#d8d8d8", security: "#759aef", social: "#ccf847" };
const GENERATING_CYCLE_MS = 3000;
const GENERATING_PHRASE_INTERVAL_MS = 2200;
const GENERATING_PHRASES = {
  productivity: ["Counting your open tabs", "Tallying screen time", "Measuring focus blocks", "Cataloguing app switches"],
  security: ["Verifying all security leaks", "Scanning open WiFi networks", "Cross-checking app permissions", "Tracing your VPN exits"],
  social: ["Reading the room", "Counting your group chats", "Tallying late-night DMs", "Decoding your meme rotation"],
};

const NOTES = [
  ["ok", "Timer on top and Tell me more below — same stack as the production dashboard capsule."],
  ["info", "Click the timer to step through pulse → harvest → scores → generating."],
  ["info", "Click Tell me more to expand Analysis panel dif color 2; click again to collapse."],
  ["warn", "Timer row hides while tell is expanded, matching the live app."],
];

let currentTheme = "prod";
let timerIndex = 0;
let tellMode = "idle";
let panelUi = freshPanelUi();
let playTimer = null;
let tellTransitionTimer = null;
let harvestPhraseTimer = null;
let harvestProgressTimer = null;
let generatingCycleTimer = null;
let generatingPhraseTimer = null;
let generatingPhraseState = null;
let timerSlotTimer = null;
let timerSlotGen = 0;

function freshPanelUi() {
  return { activeThinking: null, activeIngredient: null, activeChainStep: null };
}

function snapshotPanelUi(ui = panelUi) {
  return { activeThinking: ui.activeThinking, activeIngredient: ui.activeIngredient, activeChainStep: ui.activeChainStep };
}

function shouldRevealChainStep(index, animateFrom) {
  if (panelUi.activeChainStep !== index) return false;
  if (!animateFrom) return false;
  return animateFrom.activeChainStep !== index;
}

function shouldRevealDetail(field, animateFrom) {
  const current = panelUi[field];
  if (current === null) return false;
  if (!animateFrom) return false;
  return animateFrom[field] !== current;
}

function revealClass(should, variant = "") {
  if (!should) return "";
  return variant ? ` panel-a__reveal panel-a__reveal--${variant}` : " panel-a__reveal";
}

function detailEnterClass(should) {
  return should ? " panel-a__detail--enter" : "";
}

function pillStyle(themeKey = currentTheme) {
  const theme = THEMES[themeKey] ?? THEMES.prod;
  return `--tell-pill-accent: ${theme.accent}; --tell-pill-pastel: ${theme.pastel}; --lb-acc: ${theme.accent}; --persona-accent: ${theme.accent}`;
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function initialGeneratingPhrase(key) {
  return generatingPhraseState?.[key]?.phrases[0] ?? GENERATING_PHRASES[key][0];
}

function idleTimerMarkup(time, extraClass = "") {
  return `
    <div class="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update dashboard-timer-card--idle-countdown ${extraClass}" role="button" tabindex="-1" aria-label="Next update in ${time}">
      <span class="dashboard-update-timer">
        <span class="dashboard-update-label">Next update in</span>
        <span class="dashboard-update-time">${time}</span>
      </span>
    </div>
  `;
}

function harvestMarkup() {
  return `
    <div class="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update dashboard-timer-card--action-status dashboard-timer-card--harvest">
      <div class="update-flow update-flow--harvest">
        <p class="update-flow__harvest-phrase" id="harvestPhrase">${HARVEST_PHRASES[0]}</p>
        <div class="update-flow__harvest-foot">
          <span class="update-flow__harvest-label">Data harvesting</span>
          <span class="update-flow__harvest-pct" id="harvestPct">0%</span>
        </div>
        <div class="update-flow__track"><div class="update-flow__fill" id="harvestFill" style="width: 0%"></div></div>
      </div>
    </div>
  `;
}

function scoreUpdateMarkup() {
  const deltas = [
    ["Productivity", "#d8d8d8", "+1%", ""],
    ["Security", "#759aef", "+4%", "update-delta-col--main"],
    ["Social", "#ccf847", "-2%", ""],
  ];
  return `
    <div class="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update dashboard-timer-card--action-status dashboard-timer-card--analysis">
      <div class="update-flow update-flow--deltas">
        <div class="update-flow__delta-grid">
          ${deltas
            .map(
              ([, color, value, mod], index) => `
                <article class="persona-delta-card update-delta-col ${mod}" style="--delta-card-color: ${color}; --delta-delay: ${index * 110}ms" aria-label="${value}">
                  <span class="update-delta-col__value persona-delta-card__delta">${value}</span>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function generatingMarkup(highlightedKey = null) {
  const rows = [
    ["productivity", "#d8d8d8"],
    ["security", "#759aef"],
    ["social", "#ccf847"],
  ];
  return `
    <div class="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update dashboard-timer-card--action-status dashboard-timer-card--generating">
      <div class="update-flow update-flow--generating">
        <span class="update-flow__post-flash" id="genPostFlash" ${highlightedKey ? `style="--flash-color: ${GENERATING_COLORS[highlightedKey]}"` : "hidden"} aria-hidden="true"></span>
        <h3 class="update-flow__generating-title">Generating content<span class="generating-ellipsis"><span>.</span><span>.</span><span>.</span></span></h3>
        <div class="update-flow__gen-rows">
          ${rows
            .map(
              ([key, color]) => `
                <div class="update-gen-row${highlightedKey === key ? " update-gen-row--posted" : ""}" data-persona="${key}" style="--gen-bar-color: ${color}">
                  <p class="update-gen-row__phrase">${initialGeneratingPhrase(key)}</p>
                  <div class="update-gen-row__track"><div class="update-gen-row__shimmer"></div></div>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function tellLoadingMarkup() {
  return `
    <div class="inference-panel is-ready" role="region" aria-label="Tell me more analysis">
      <div class="tell-load tell-load--loop tell-load--compact" aria-hidden="true">
        <div class="tell-load__skel"></div>
        <div class="tell-load__skel"></div>
        <div class="tell-load__skel tell-load__skel--solid"></div>
      </div>
    </div>
  `;
}

function idleTellMarkup(themeKey) {
  const theme = THEMES[themeKey] ?? THEMES.prod;
  return `
    <button type="button" class="tell-more-pill tell-more-pill--idle" style="${pillStyle(themeKey)}" data-showcase-tell-toggle aria-label="Tell me more">
      <div class="tell-idle-a">
        <div class="tell-idle-a__top">
          <span class="tell-idle-a__persona">${theme.label} post</span>
          <span class="tell-idle-a__dots" aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
        <div class="tell-idle-a__bars" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="tell-idle-a__cta"><span>Tell me why</span><b>→</b></div>
      </div>
    </button>
  `;
}

function buildAlt2PanelMarkup({ animateFrom = null } = {}) {
  const { activeThinking, activeIngredient, activeChainStep } = panelUi;
  const quoteParts = NORMAL_POST.content.split(NORMAL_POST.highlightPhrase);
  const quoteBefore = quoteParts[0] ?? "";
  const quoteAfter = quoteParts.slice(1).join(NORMAL_POST.highlightPhrase);

  return `
    <div class="tell-panel-a tell-panel-a--alt-palette-2 inference-panel is-ready" role="region" aria-label="Tell me more analysis">
      <div class="post-quote-a">
        <span class="panel-a__head">Why this CONTENT?</span>
        <p class="post-quote-a__text"><span class="post-quote-a__open" aria-hidden="true">“</span>${quoteBefore}<button type="button" class="post-quote-a__highlight" data-showcase-interactive data-chip-kind="ingredient" data-chip-index="${NORMAL_POST.highlightIngredientIndex}">${NORMAL_POST.highlightPhrase}</button>${quoteAfter}<span class="post-quote-a__close" aria-hidden="true">”</span></p>
      </div>
      <section class="tape-section" aria-label="From data to post">
        <header class="panel-a__head">From data to post</header>
        <div class="tape">
          ${SIMPLE_CHAIN.map(
            (item, i) => `
              <div class="tape__row">
                <div class="tape__step">
                  <div class="tape__badge">${i + 1}</div>
                  ${i < SIMPLE_CHAIN.length - 1 ? '<div class="tape__line"></div>' : ""}
                </div>
                <button type="button" class="tape__content${activeChainStep === i ? " is-open" : ""}" data-showcase-interactive data-chip-kind="chain" data-chip-index="${i}">
                  <span class="tape__label">${item.label}</span>
                  ${activeChainStep === i ? `<span class="tape__value${revealClass(shouldRevealChainStep(i, animateFrom))}">${item.value}</span><span class="tape__detail${revealClass(shouldRevealChainStep(i, animateFrom), "late")}">${item.detail}<span class="tape__meta"><span class="tape__tag${revealClass(shouldRevealChainStep(i, animateFrom), "later")}">${item.tag}</span></span></span>` : ""}
                </button>
              </div>
            `,
          ).join("")}
        </div>
      </section>
      <section class="reason-section">
        <header class="panel-a__head">How we framed it</header>
        <div class="reason-chips">
          ${THINKING.map(
            (item, i) => `
              <button type="button" class="reason-chip${activeThinking === i ? " is-open" : ""}" data-showcase-interactive data-chip-kind="thinking" data-chip-index="${i}">${item.label}</button>
            `,
          ).join("")}
        </div>
        ${
          activeThinking !== null
            ? `<div class="panel-a__detail${detailEnterClass(shouldRevealDetail("activeThinking", animateFrom))}">
                <span class="panel-a__detail-label">${THINKING[activeThinking].label}</span>
                <p>${THINKING[activeThinking].detail}</p>
              </div>`
            : ""
        }
      </section>
      <section class="ing-section">
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
            ? `<div class="panel-a__detail${detailEnterClass(shouldRevealDetail("activeIngredient", animateFrom))}">
                <b>${INGREDIENTS[activeIngredient].label}</b>
                <ul>${INGREDIENTS[activeIngredient].points.map((p) => `<li>${p}</li>`).join("")}</ul>
              </div>`
            : ""
        }
      </section>
    </div>
  `;
}

function expandedTellMarkup({ closing = false, panelHtml = tellLoadingMarkup() }) {
  return `
    <div class="tell-more-pill tell-more-pill--expanded tell-more-pill--alt-palette-2${closing ? " tell-more-pill--closing" : ""}" style="${pillStyle()}" data-showcase-tell-toggle role="region" aria-label="Inference chain analysis">
      <div id="tellPanel" class="tell-panel-host">${panelHtml}</div>
    </div>
  `;
}

function applyTheme(theme) {
  currentTheme = theme;
  document.body.className = THEMES[theme].className;
  $$(".themeswitch button").forEach((button) => {
    button.classList.toggle("is-on", button.dataset.theme === theme);
  });
  const capsule = $("#capsule");
  if (capsule) capsule.style.cssText = pillStyle(theme);
  renderTellRow();
}

function applyCapsuleClasses() {
  const capsule = $("#capsule");
  const expanded = tellMode === "expanded" || tellMode === "loading" || tellMode === "closing";
  capsule.dataset.tellMode = tellMode;
  capsule.classList.toggle("is-tell-expanded", expanded);
  capsule.classList.toggle("is-tell-closing", tellMode === "closing");
  capsule.classList.toggle("is-tell-alt-palette-2", expanded);
}

function updateFrameMeta() {
  const timer = TIMER_STATES[timerIndex];
  const tellLabel = tellMode === "idle" ? "idle" : tellMode === "loading" ? "loading" : tellMode === "closing" ? "closing" : "expanded";
  $("#frameMeta").textContent = `Timer · ${timer.id} · Tell · ${tellLabel}`;
}

function buildRail() {
  $("#rail").innerHTML = `
    <div class="rail__title">Combined dashboard</div>
    <button type="button" class="navitem is-on" aria-current="true">
      <span class="navitem__n">00</span>
      <span class="navitem__t">Timer + Tell me more</span>
      <span class="navitem__s">interactive preview</span>
    </button>
  `;
}

function buildNotes() {
  $("#notes").innerHTML = `
    <div class="notes__title">Notes · combined behavior</div>
    <div class="notes__screen">Dashboard preview</div>
    ${NOTES.map(([type, text]) => {
      const mark = type === "ok" ? "✓" : type === "warn" ? "▲" : "◦";
      return `<div class="note note--${type}"><span class="note__mk">${mark}</span><span>${text}</span></div>`;
    }).join("")}
  `;
}

function stopHarvestAnimation() {
  window.clearInterval(harvestPhraseTimer);
  window.clearInterval(harvestProgressTimer);
  harvestPhraseTimer = null;
  harvestProgressTimer = null;
}

function stopGeneratingAnimation() {
  window.clearInterval(generatingCycleTimer);
  window.clearInterval(generatingPhraseTimer);
  generatingCycleTimer = null;
  generatingPhraseTimer = null;
  generatingPhraseState = null;
}

function stopSlotAnimations() {
  stopHarvestAnimation();
  stopGeneratingAnimation();
}

function setGeneratingHighlight(key) {
  $$("[data-persona]").forEach((row) => {
    row.classList.toggle("update-gen-row--posted", row.dataset.persona === key);
  });
  const flash = $("#genPostFlash");
  if (!flash) return;
  if (!key) {
    flash.hidden = true;
    return;
  }
  flash.hidden = false;
  flash.style.setProperty("--flash-color", GENERATING_COLORS[key]);
  flash.classList.remove("update-flow__post-flash");
  void flash.offsetWidth;
  flash.classList.add("update-flow__post-flash");
}

function cycleGeneratingPhrases() {
  if (!generatingPhraseState) return;
  GENERATING_KEYS.forEach((key) => {
    const phraseEl = document.querySelector(`[data-persona="${key}"] .update-gen-row__phrase`);
    const state = generatingPhraseState[key];
    if (!phraseEl || !state) return;
    state.index = (state.index + 1) % state.phrases.length;
    phraseEl.classList.remove("is-changing");
    void phraseEl.offsetWidth;
    phraseEl.textContent = state.phrases[state.index];
    phraseEl.classList.add("is-changing");
  });
}

function startGeneratingAnimation() {
  stopGeneratingAnimation();
  generatingPhraseState = Object.fromEntries(
    GENERATING_KEYS.map((key) => [key, { phrases: shuffle(GENERATING_PHRASES[key]), index: 0 }]),
  );
  let step = 0;
  const tick = () => {
    const phase = step % (GENERATING_KEYS.length * 2);
    setGeneratingHighlight(phase % 2 === 1 ? GENERATING_KEYS[(phase - 1) / 2] : null);
    step += 1;
  };
  tick();
  generatingCycleTimer = window.setInterval(tick, GENERATING_CYCLE_MS);
  generatingPhraseTimer = window.setInterval(cycleGeneratingPhrases, GENERATING_PHRASE_INTERVAL_MS);
}

function startHarvestAnimation() {
  stopHarvestAnimation();
  let phraseIndex = 0;
  let progress = 0;
  const updateProgress = () => {
    const pct = $("#harvestPct");
    const fill = $("#harvestFill");
    if (!pct || !fill) return;
    progress = progress >= 95 ? 8 : progress + 4;
    pct.textContent = `${progress}%`;
    fill.style.width = `${progress}%`;
  };
  updateProgress();
  harvestProgressTimer = window.setInterval(updateProgress, 420);
  harvestPhraseTimer = window.setInterval(() => {
    const phrase = $("#harvestPhrase");
    if (!phrase) return;
    phraseIndex = (phraseIndex + 1) % HARVEST_PHRASES.length;
    phrase.classList.remove("is-changing");
    void phrase.offsetWidth;
    phrase.textContent = HARVEST_PHRASES[phraseIndex];
    phrase.classList.add("is-changing");
  }, 1500);
}

function afterTimerRender(state) {
  stopSlotAnimations();
  if (state.id === "harvesting") startHarvestAnimation();
  if (state.id === "generating") startGeneratingAnimation();
}

function setTimerSlot(html, { animate = true } = {}) {
  const slot = $("#timerSlot");
  const state = TIMER_STATES[timerIndex];
  window.clearTimeout(timerSlotTimer);
  const gen = ++timerSlotGen;

  const apply = () => {
    if (gen !== timerSlotGen) return;
    slot.innerHTML = html;
    slot.classList.remove("is-leaving", "is-entering");
    afterTimerRender(state);
    updateFrameMeta();
  };

  if (!animate) {
    apply();
    return;
  }

  slot.classList.remove("is-entering");
  slot.classList.add("is-leaving");
  timerSlotTimer = window.setTimeout(() => {
    apply();
    slot.classList.remove("is-leaving");
    slot.classList.add("is-entering");
    timerSlotTimer = window.setTimeout(() => {
      if (gen === timerSlotGen) slot.classList.remove("is-entering");
    }, 460);
  }, 210);
}

function renderTimer({ animate = false } = {}) {
  if (tellMode !== "idle") return;
  setTimerSlot(TIMER_STATES[timerIndex].render(), { animate });
}

function renderTellRow() {
  const row = $("#tellRow");
  if (tellMode === "idle") {
    row.innerHTML = idleTellMarkup(currentTheme);
  } else {
    const panelHtml =
      tellMode === "loading" ? tellLoadingMarkup() : tellMode === "closing" ? buildAlt2PanelMarkup() : buildAlt2PanelMarkup();
    row.innerHTML = expandedTellMarkup({ closing: tellMode === "closing", panelHtml });
  }
  applyCapsuleClasses();
  updateFrameMeta();
}

function refreshPanel(animateFrom = null) {
  if (tellMode !== "expanded") return;
  const panel = $("#tellPanel");
  if (!panel) return;
  panel.innerHTML = buildAlt2PanelMarkup({ animateFrom });
}

function advanceTimer() {
  if (tellMode !== "idle") return;
  timerIndex = (timerIndex + 1) % TIMER_STATES.length;
  renderTimer({ animate: true });
}

function clearTellTransition() {
  window.clearTimeout(tellTransitionTimer);
  tellTransitionTimer = null;
}

function expandTell() {
  if (tellMode !== "idle") return;
  clearTellTransition();
  panelUi = freshPanelUi();
  tellMode = "loading";
  renderTellRow();
  tellTransitionTimer = window.setTimeout(() => {
    tellMode = "expanded";
    renderTellRow();
  }, EXPAND_LOADING_MS);
}

function collapseTell() {
  if (tellMode !== "expanded") return;
  clearTellTransition();
  tellMode = "closing";
  renderTellRow();
  tellTransitionTimer = window.setTimeout(() => {
    tellMode = "idle";
    panelUi = freshPanelUi();
    renderTellRow();
    renderTimer({ animate: false });
  }, CLOSE_MS);
}

function toggleChip(kind, index) {
  const before = snapshotPanelUi();
  if (kind === "thinking") panelUi.activeThinking = panelUi.activeThinking === index ? null : index;
  else if (kind === "ingredient") panelUi.activeIngredient = panelUi.activeIngredient === index ? null : index;
  else if (kind === "chain") panelUi.activeChainStep = panelUi.activeChainStep === index ? null : index;
  refreshPanel(before);
}

function resetView() {
  window.clearTimeout(playTimer);
  window.clearTimeout(timerSlotTimer);
  timerSlotGen += 1;
  clearTellTransition();
  stopSlotAnimations();
  timerIndex = 0;
  tellMode = "idle";
  panelUi = freshPanelUi();
  renderTimer({ animate: false });
  renderTellRow();
}

function playTimerFlow(index = 0) {
  if (tellMode !== "idle") return;
  timerIndex = index % TIMER_STATES.length;
  renderTimer({ animate: index !== 0 });
  playTimer = window.setTimeout(() => playTimerFlow(timerIndex + 1), timerIndex === 0 ? 5200 : 2600);
}

function handleTellRowClick(event) {
  if (event.target.closest("[data-showcase-interactive]")) {
    event.stopPropagation();
    const kind = event.target.closest("[data-showcase-interactive]").dataset.chipKind;
    const index = Number(event.target.closest("[data-showcase-interactive]").dataset.chipIndex);
    if (kind && Number.isFinite(index)) toggleChip(kind, index);
    return;
  }

  if (tellMode === "idle") {
    event.stopPropagation();
    expandTell();
    return;
  }

  if (tellMode === "expanded" && event.target.closest("[data-showcase-tell-toggle]")) {
    event.stopPropagation();
    collapseTell();
  }
}

function handleTimerSlotClick(event) {
  if (tellMode !== "idle") return;
  event.preventDefault();
  advanceTimer();
}

buildRail();
buildNotes();
applyTheme("prod");
renderTimer({ animate: false });
renderTellRow();

$("#timerSlot").addEventListener("click", handleTimerSlotClick, true);
$("#tellRow").addEventListener("click", handleTellRowClick);
$("#playTimerFlow").addEventListener("click", () => {
  window.clearTimeout(playTimer);
  playTimerFlow(0);
});
$("#resetView").addEventListener("click", resetView);

$$(".themeswitch button").forEach((button) => {
  button.addEventListener("click", () => applyTheme(button.dataset.theme));
});
