/** In-memory harvest job shared between WebDiplome UI and Electron collector. */

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

let session = {
  status: 'idle',
  scoresBefore: null,
  scoresAfter: null,
  progress: emptyProgress(),
  error: null,
  updatedAt: Date.now(),
};

function touch() {
  session.updatedAt = Date.now();
}

function parseLine(line) {
  let step = session.progress.step;
  for (const sp of STEP_PATTERNS) {
    if (sp.pattern.test(line) && sp.step > step) {
      step = sp.step;
      break;
    }
  }
  const pct =
    step >= 4 ? 100 : Math.min(95, Math.round((step / 4) * 95));
  const match = STEP_PATTERNS.find((sp) => sp.step === step);
  return {
    step,
    percent: pct,
    statusText: match?.label ?? session.progress.statusText,
  };
}

export function getHarvestStatus() {
  return {
    status: session.status,
    scoresBefore: session.scoresBefore,
    scoresAfter: session.scoresAfter,
    progress: {
      ...session.progress,
      lines: [...session.progress.lines].slice(-MAX_LOG_LINES),
    },
    error: session.error,
    updatedAt: session.updatedAt,
  };
}

export function requestHarvest(scoresBefore) {
  if (session.status === 'requested' || session.status === 'running') {
    return { ok: false, error: 'Harvest already in progress' };
  }
  session = {
    status: 'requested',
    scoresBefore: scoresBefore ?? null,
    scoresAfter: null,
    progress: emptyProgress(),
    error: null,
    updatedAt: Date.now(),
  };
  return { ok: true };
}

export function markHarvestRunning() {
  if (session.status !== 'requested') return { ok: false };
  session.status = 'running';
  session.progress.statusText = 'Collecting data from your machine…';
  touch();
  return { ok: true };
}

export function pushHarvestProgress({ line, statusText, percent, step, phase } = {}) {
  if (session.status !== 'running' && session.status !== 'requested') return { ok: false };
  if (session.status === 'requested') session.status = 'running';

  if (typeof line === 'string' && line.trim()) {
    session.progress.lines.push(line.trim());
    if (session.progress.lines.length > MAX_LOG_LINES) {
      session.progress.lines = session.progress.lines.slice(-MAX_LOG_LINES);
    }
    const parsed = parseLine(line);
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
    session.progress.percent = 100;
    session.progress.step = 4;
  }
  touch();
  return { ok: true };
}

export function completeHarvest(scoresAfter) {
  session.status = 'done';
  session.scoresAfter = scoresAfter ?? null;
  session.progress.percent = 100;
  session.progress.step = 4;
  session.progress.statusText = 'Collection complete.';
  session.error = null;
  touch();
  return { ok: true };
}

export function failHarvest(error) {
  session.status = 'error';
  session.error = error ? String(error) : 'Harvest failed';
  touch();
  return { ok: true };
}

export function ackHarvest() {
  if (session.status === 'done' || session.status === 'error') {
    session.status = 'idle';
    session.error = null;
    touch();
  }
  return { ok: true };
}
