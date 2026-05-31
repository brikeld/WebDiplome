/** Per-profile harvest jobs (web UI ↔ Electron on that user's machine). */

const MAX_LOG_LINES = 120;

const STEP_PATTERNS = [
  { pattern: /\[1\/4\]/, step: 1, label: 'Machine identity…' },
  { pattern: /\[2\/4\]/, step: 2, label: 'History (7 days)…' },
  { pattern: /\[3\/4\]/, step: 3, label: 'Assets…' },
  { pattern: /\[4\/4\]/, step: 4, label: 'Scoring signals…' },
];

function emptyProgress() {
  return { step: 0, percent: 0, statusText: 'Initializing system scan…', lines: [] };
}

function emptySession() {
  return {
    status: 'idle',
    scoresBefore: null,
    scoresAfter: null,
    dynamicOnly: false,
    progress: emptyProgress(),
    error: null,
    updatedAt: Date.now(),
  };
}

/** @type {Map<string, ReturnType<typeof emptySession>>} */
const sessions = new Map();

function normalizeSlug(slug) {
  const s = String(slug || '').trim();
  return s || null;
}

function getSession(slug) {
  const key = normalizeSlug(slug);
  if (!key) return emptySession();
  if (!sessions.has(key)) sessions.set(key, emptySession());
  return sessions.get(key);
}

function touch(session) {
  session.updatedAt = Date.now();
}

function parseLine(session, line) {
  let step = session.progress.step;
  for (const sp of STEP_PATTERNS) {
    if (sp.pattern.test(line) && sp.step > step) {
      step = sp.step;
      break;
    }
  }
  const STEP_PERCENT = { 0: 8, 1: 28, 2: 52, 3: 76, 4: 88 };
  const pct = STEP_PERCENT[step] ?? session.progress.percent;
  const match = STEP_PATTERNS.find((sp) => sp.step === step);
  return {
    step,
    percent: pct,
    statusText: match?.label ?? session.progress.statusText,
  };
}

function serializeSession(session) {
  return {
    status: session.status,
    scoresBefore: session.scoresBefore,
    scoresAfter: session.scoresAfter,
    dynamicOnly: session.dynamicOnly,
    progress: {
      ...session.progress,
      lines: [...session.progress.lines].slice(-MAX_LOG_LINES),
    },
    error: session.error,
    updatedAt: session.updatedAt,
  };
}

export function getHarvestStatus(profileSlug) {
  return serializeSession(getSession(profileSlug));
}

export function requestHarvest(scoresBefore, { dynamicOnly = false, profileSlug = null } = {}) {
  const key = normalizeSlug(profileSlug);
  if (!key) return { ok: false, error: 'profileSlug required' };

  const session = getSession(key);
  if (session.status === 'requested' || session.status === 'running') {
    return { ok: false, error: 'Harvest already in progress' };
  }

  sessions.set(key, {
    status: 'requested',
    scoresBefore: scoresBefore ?? null,
    scoresAfter: null,
    dynamicOnly: !!dynamicOnly,
    progress: dynamicOnly
      ? { ...emptyProgress(), statusText: 'Fast harvest (reusing machine info)…' }
      : emptyProgress(),
    error: null,
    updatedAt: Date.now(),
  });
  return { ok: true };
}

export function markHarvestRunning(profileSlug) {
  const session = getSession(profileSlug);
  if (session.status !== 'requested') return { ok: false };
  session.status = 'running';
  session.progress.statusText = 'Collecting data from your machine…';
  touch(session);
  return { ok: true };
}

export function pushHarvestProgress(profileSlug, payload = {}) {
  const session = getSession(profileSlug);
  if (session.status !== 'running' && session.status !== 'requested') return { ok: false };
  if (session.status === 'requested') session.status = 'running';

  const { line, statusText, percent, step, phase } = payload;
  if (typeof line === 'string' && line.trim()) {
    session.progress.lines.push(line.trim());
    if (session.progress.lines.length > MAX_LOG_LINES) {
      session.progress.lines = session.progress.lines.slice(-MAX_LOG_LINES);
    }
    const parsed = parseLine(session, line);
    session.progress.step = parsed.step;
    session.progress.percent = parsed.percent;
    session.progress.statusText = parsed.statusText;
  }
  if (typeof statusText === 'string') session.progress.statusText = statusText;
  if (typeof percent === 'number' && Number.isFinite(percent)) {
    session.progress.percent = Math.max(0, Math.min(100, Math.round(percent)));
  }
  if (typeof step === 'number' && Number.isFinite(step)) session.progress.step = step;
  if (phase === 'analyzing') {
    session.progress.statusText = 'Analyzing collected data…';
    session.progress.percent = 95;
    session.progress.step = 4;
  }
  touch(session);
  return { ok: true };
}

export function completeHarvest(profileSlug, scoresAfter) {
  const session = getSession(profileSlug);
  session.status = 'done';
  session.scoresAfter = scoresAfter ?? null;
  session.progress.percent = 100;
  session.progress.step = 4;
  session.progress.statusText = 'Collection complete.';
  session.error = null;
  touch(session);
  return { ok: true };
}

export function failHarvest(profileSlug, error) {
  const session = getSession(profileSlug);
  session.status = 'error';
  session.error = error ? String(error) : 'Harvest failed';
  touch(session);
  return { ok: true };
}

export function ackHarvest(profileSlug) {
  const session = getSession(profileSlug);
  if (session.status === 'done' || session.status === 'error') {
    sessions.set(normalizeSlug(profileSlug), emptySession());
  }
  return { ok: true };
}

export function resetHarvestSession(profileSlug = null) {
  if (profileSlug) {
    sessions.delete(normalizeSlug(profileSlug));
  } else {
    sessions.clear();
  }
  return { ok: true };
}
