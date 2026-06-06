const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const THEMES = {
  prod: { className: "theme-prod", accent: "#d8d8d8", label: "Productivity" },
  sec: { className: "theme-sec", accent: "#759aef", label: "Security" },
  soc: { className: "theme-soc", accent: "#ccf847", label: "Social" },
};

const HARVEST_PHRASES = [
  "Reading wallpaper pixels",
  "Scanning recent downloads",
  "Indexing open applications",
  "Mapping filesystem traces",
  "Capturing screen habits",
  "Profiling keyboard tempo",
  "Harvesting browser tabs",
  "Measuring idle gaps",
  "Cataloguing dock apps",
  "Sampling Wi-Fi names",
  "Reading system locale",
  "Tracing file access times",
  "Sweeping screenshot folder",
  "Parsing calendar density",
  "Counting notification badges",
  "Interrogating the clipboard",
  "Timing app switch rhythm",
  "Collecting recent images",
  "Tracing Spotlight queries",
  "Harvesting menu bar traces",
];

const STATES = [
  {
    id: "pulse",
    title: "Timer pulse",
    status: "Default / ready",
    theme: "sec",
    notes: [
      ["ok", "This is the normal timer state for this showcase: the button is alive and ready to trigger the update flow."],
      ["info", "Click directly inside the timer preview to move to the next state."],
      ["warn", "The glow should read as an invitation, not as an error or alert."],
    ],
    render: () => idleMarkup("00:04", "dashboard-timer-card--countdown-pulse"),
  },
  {
    id: "harvesting",
    title: "Harvesting",
    status: "Desktop collector",
    theme: "sec",
    notes: [
      ["ok", "Shows that the app is actively collecting fresh local data."],
      ["info", "This showcase rotates the same kind of phrases as the real HarvestScreen and animates progress continuously."],
      ["warn", "Long harvest phrases should not clip inside the timer slot."],
    ],
    render: () => harvestMarkup(),
  },
  {
    id: "scores",
    title: "Score update",
    status: "Persona deltas",
    theme: "sec",
    notes: [
      ["ok", "Shows the result of the harvest before content generation starts."],
      ["info", "Each persona gets its own delta column: productivity, security, social."],
      ["warn", "The dominant persona column should feel strongest without hiding the other two."],
    ],
    render: () => scoreUpdateMarkup(),
  },
  {
    id: "generating",
    title: "Generating content",
    status: "LM Studio posts",
    theme: "sec",
    notes: [
      ["ok", "Three persona rows show parallel content generation without leaving the timer footprint."],
      ["info", "The highlighted row pulses when a post lands in the feed."],
      ["warn", "If the model is slow, this state may be visible for a while, so the shimmer must feel stable."],
    ],
    render: () => generatingMarkup(),
  },
];

const GENERATING_KEYS = ["productivity", "security", "social"];

const GENERATING_COLORS = {
  productivity: "#d8d8d8",
  security: "#759aef",
  social: "#ccf847",
};

const GENERATING_CYCLE_MS = 3000;
const GENERATING_PHRASE_INTERVAL_MS = 2200;

const GENERATING_PHRASES = {
  productivity: [
    "Counting your open tabs",
    "Tallying screen time",
    "Measuring focus blocks",
    "Cataloguing app switches",
    "Reviewing recent downloads",
    "Inspecting calendar gaps",
    "Auditing keyboard rhythm",
    "Profiling your peak hours",
    "Stacking your to-do list",
    "Summarizing meeting density",
  ],
  security: [
    "Verifying all security leaks",
    "Scanning open WiFi networks",
    "Cross-checking app permissions",
    "Tracing your VPN exits",
    "Sweeping browser fingerprints",
    "Auditing keychain entries",
    "Reviewing camera access logs",
    "Validating SSL certificates",
    "Profiling your threat model",
    "Decrypting sandbox traces",
  ],
  social: [
    "Reading the room",
    "Counting your group chats",
    "Tallying late-night DMs",
    "Decoding your meme rotation",
    "Charting friend activity",
    "Measuring reply latency",
    "Profiling your vibe",
    "Sweeping your timeline",
    "Mapping your social graph",
    "Ranking inside jokes",
  ],
};

let currentIndex = 0;
let currentTheme = "sec";
let playTimer = null;
let harvestPhraseTimer = null;
let harvestProgressTimer = null;
let generatingCycleTimer = null;
let generatingPhraseTimer = null;
let generatingPhraseState = null;

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

function idleMarkup(time, extraClass = "", flashColor = "") {
  const flash = flashColor
    ? `<span class="dashboard-timer-card__post-flash" style="--flash-color: ${flashColor}" aria-hidden="true"></span>`
    : "";
  return `
    <button type="button" class="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update dashboard-timer-card--idle-countdown ${extraClass}">
      ${flash}
      <span class="dashboard-update-timer">
        <span class="dashboard-update-label">Next update in</span>
        <span class="dashboard-update-time">${time}</span>
      </span>
    </button>
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
              ([label, color, value, mod], index) => `
                <article class="persona-delta-card update-delta-col ${mod}" style="--delta-card-color: ${color}; --delta-delay: ${index * 110}ms" aria-label="${label} ${value}">
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
  const rowHtml = rows
    .map(
      ([key, color]) => `
        <div class="update-gen-row${highlightedKey === key ? " update-gen-row--posted" : ""}" data-persona="${key}" style="--gen-bar-color: ${color}">
          <p class="update-gen-row__phrase">${initialGeneratingPhrase(key)}</p>
          <div class="update-gen-row__track"><div class="update-gen-row__shimmer"></div></div>
        </div>
      `,
    )
    .join("");

  const flash = highlightedKey
    ? `<span class="update-flow__post-flash" id="genPostFlash" style="--flash-color: ${GENERATING_COLORS[highlightedKey]}" aria-hidden="true"></span>`
    : `<span class="update-flow__post-flash" id="genPostFlash" hidden aria-hidden="true"></span>`;

  return `
    <div class="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update dashboard-timer-card--action-status dashboard-timer-card--generating">
      <div class="update-flow update-flow--generating">
        ${flash}
        <h3 class="update-flow__generating-title">Generating content<span class="generating-ellipsis"><span>.</span><span>.</span><span>.</span></span></h3>
        <div class="update-flow__gen-rows">${rowHtml}</div>
      </div>
    </div>
  `;
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
  rail.innerHTML = `<div class="rail__title">Timer states · ${STATES.length}</div>`;
  STATES.forEach((state, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "navitem";
    button.dataset.state = state.id;
    button.innerHTML = `
      <span class="navitem__n">${String(index).padStart(2, "0")}</span>
      <span class="navitem__t">${state.title}</span>
      <span class="navitem__s">${state.status}</span>
    `;
    button.addEventListener("click", () => showState(index));
    rail.appendChild(button);
  });
}

function buildNotes(state) {
  $("#notes").innerHTML = `
    <div class="notes__title">Notes · timer behavior</div>
    <div class="notes__screen">${state.title}</div>
    ${state.notes
      .map(([type, text]) => {
        const mark = type === "ok" ? "✓" : type === "warn" ? "▲" : "◦";
        return `<div class="note note--${type}"><span class="note__mk">${mark}</span><span>${text}</span></div>`;
      })
      .join("")}
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
    const isPosted = row.dataset.persona === key;
    row.classList.remove("update-gen-row--posted");
    if (isPosted) {
      void row.offsetWidth;
      row.classList.add("update-gen-row--posted");
    }
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

  GENERATING_KEYS.forEach((key) => {
    const phraseEl = document.querySelector(`[data-persona="${key}"] .update-gen-row__phrase`);
    if (phraseEl) phraseEl.textContent = generatingPhraseState[key].phrases[0];
  });

  let step = 0;

  const tick = () => {
    const phase = step % (GENERATING_KEYS.length * 2);
    const highlightedKey = phase % 2 === 1 ? GENERATING_KEYS[(phase - 1) / 2] : null;
    setGeneratingHighlight(highlightedKey);
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

function afterSlotRender(state) {
  stopSlotAnimations();
  if (state.id === "harvesting") {
    startHarvestAnimation();
  }
  if (state.id === "generating") {
    startGeneratingAnimation();
  }
}

function setTimerSlot(html) {
  const slot = $("#timerSlot");
  slot.classList.remove("is-entering");
  slot.classList.add("is-leaving");
  window.setTimeout(() => {
    slot.innerHTML = html;
    slot.classList.remove("is-leaving");
    slot.classList.add("is-entering");
    window.setTimeout(() => slot.classList.remove("is-entering"), 460);
    afterSlotRender(STATES[currentIndex]);
  }, 210);
}

function updateChrome(state) {
  $("#frameMeta").textContent = state.status;
  $$(".navitem").forEach((button) => {
    button.classList.toggle("is-on", button.dataset.state === state.id);
  });
  buildNotes(state);
}

function showState(index, { animate = true, keepPlaying = false } = {}) {
  if (!keepPlaying) window.clearTimeout(playTimer);
  currentIndex = (index + STATES.length) % STATES.length;
  const state = STATES[currentIndex];
  applyTheme(state.theme || currentTheme);
  if (animate) {
    setTimerSlot(state.render());
  } else {
    $("#timerSlot").innerHTML = state.render();
    afterSlotRender(state);
  }
  updateChrome(state);
}

function playFlow(index = 0) {
  currentIndex = index % STATES.length;
  const state = STATES[currentIndex];
  applyTheme(state.theme || currentTheme);
  setTimerSlot(state.render());
  updateChrome(state);
  playTimer = window.setTimeout(() => playFlow(currentIndex + 1), currentIndex === 0 ? 5200 : 2600);
}

buildRail();
showState(0, { animate: false });

$("#prevState").addEventListener("click", () => showState(currentIndex - 1));
$("#nextState").addEventListener("click", () => showState(currentIndex + 1));
$("#playSequence").addEventListener("click", () => playFlow(0));
$("#timerSlot").addEventListener("click", () => showState(currentIndex + 1));

$$(".themeswitch button").forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.theme);
    setTimerSlot(STATES[currentIndex].render());
  });
});
