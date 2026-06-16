/** @typedef {{ x: number, y: number, width: number, height: number }} PlainRect */

export const GENERATION_PARTICLE_EVENT = 'wd:generation-particle';

const PERSONA_UI_COLORS = {
  productivity: '#D8D8D8',
  security: '#759AEF',
  social: '#CCF847',
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

/** Travel time from the generating row to the reserved feed slot (own generation). */
export const GENERATION_PARTICLE_FLIGHT_MS = 700;
/** Travel time for the demo descent (a post arriving from another user). */
export const GENERATION_PARTICLE_DEMO_FLIGHT_MS = 560;
/** Impact lifetime after landing — core pop + shockwave. Mirror `--burst-ms` in CSS. */
export const GENERATION_PARTICLE_BURST_MS = 500;
export const GENERATION_PARTICLE_SIZE = 32;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

const EASE_AT_HALF = easeOutCubic(0.5);

export function personaToGeneratingRowKey(persona) {
  const k = String(persona ?? '').toLowerCase();
  if (k.startsWith('prod')) return 'productivity';
  if (k.startsWith('sec')) return 'security';
  if (k.startsWith('pop') || k === 'social') return 'social';
  return 'productivity';
}

export function personaUiColorForParticle(persona) {
  const key = personaToGeneratingRowKey(persona);
  if (key === 'productivity') return PERSONA_UI_COLORS.productivity;
  if (key === 'security') return PERSONA_UI_COLORS.security;
  return PERSONA_UI_COLORS.social;
}

export function plainRectFromDomRect(rect) {
  if (!rect) return null;
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/** Source: generating card on the dashboard timer row. */
export function getGeneratingSourceRect(persona) {
  if (typeof document === 'undefined') return null;
  const rowKey = personaToGeneratingRowKey(persona);
  const activeRow = document.querySelector(`.update-gen-row[data-gen-persona="${rowKey}"]`);
  if (activeRow) return plainRectFromDomRect(activeRow.getBoundingClientRect());

  const card = document.querySelector('.dashboard-timer-card--generating');
  if (card) return plainRectFromDomRect(card.getBoundingClientRect());

  const flow = document.querySelector('.update-flow--generating');
  if (flow) return plainRectFromDomRect(flow.getBoundingClientRect());

  return null;
}

/** Target: reserved slot at the top of the feed where the next post lands. */
export function getFeedRevealTargetRect() {
  if (typeof document === 'undefined') return null;
  const target = document.querySelector('[data-feed-reveal-target]');
  if (target) return plainRectFromDomRect(target.getBoundingClientRect());

  const shell = document.querySelector('.post-card-shell');
  if (shell) return plainRectFromDomRect(shell.getBoundingClientRect());

  const tab = document.querySelector('.posts-tab');
  if (tab) {
    const rect = tab.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y + Math.min(rect.height * 0.12, 96),
      width: rect.width,
      height: 48,
    };
  }
  return null;
}

export function prefersReducedGenerationMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Request a portal-rendered sphere flight; resolves when the particle hits
 * the feed target (or immediately when rects / motion prefs unavailable).
 */
export function animateGenerationParticleToFeed(persona) {
  if (prefersReducedGenerationMotion()) return Promise.resolve();

  return new Promise((resolve) => {
    setTimeout(() => {
      const sourceRect = getGeneratingSourceRect(persona);
      const targetRect = getFeedRevealTargetRect();
      if (!sourceRect || !targetRect) { resolve(); return; }
      window.dispatchEvent(new CustomEvent(GENERATION_PARTICLE_EVENT, {
        detail: { persona, sourceRect, targetRect, resolve, variant: 'generation' },
      }));
    }, 0);
  });
}

export function createGenerationBeforeReveal() {
  return async (post) => {
    await animateGenerationParticleToFeed(post?.persona ?? null);
  };
}

/** Target for a demo reveal: the top of the feed where the prepended post lands. */
export function getDemoRevealTargetRect() {
  if (typeof document === 'undefined') return null;
  const shell = document.querySelector('.posts-tab .post-card-shell');
  if (shell) {
    const r = shell.getBoundingClientRect();
    return { x: r.x, y: r.y + 4, width: r.width, height: 36 };
  }
  const tab = document.querySelector('.posts-tab');
  if (tab) {
    const r = tab.getBoundingClientRect();
    return { x: r.x, y: r.y + 24, width: r.width, height: 36 };
  }
  return getFeedRevealTargetRect();
}

/** Source for a demo reveal: just below the header, centered above the slot. */
function getDemoSourceRect(targetRect) {
  if (!targetRect) return null;
  const cx = targetRect.x + targetRect.width / 2;
  const top = Math.max(80, targetRect.y - 120);
  return { x: cx - GENERATION_PARTICLE_SIZE / 2, y: top - GENERATION_PARTICLE_SIZE / 2, width: GENERATION_PARTICLE_SIZE, height: GENERATION_PARTICLE_SIZE };
}

/**
 * Request a portal-rendered sphere that descends into the feed slot and bursts
 * — imitating a post arriving from another user. Resolves at impact.
 */
export function animateDemoParticleToFeed(persona) {
  if (prefersReducedGenerationMotion()) return Promise.resolve();

  return new Promise((resolve) => {
    setTimeout(() => {
      const targetRect = getDemoRevealTargetRect();
      const sourceRect = getDemoSourceRect(targetRect);
      if (!sourceRect || !targetRect) { resolve(); return; }
      window.dispatchEvent(new CustomEvent(GENERATION_PARTICLE_EVENT, {
        detail: { persona, sourceRect, targetRect, resolve, variant: 'demo' },
      }));
    }, 0);
  });
}

export function createDemoBeforeReveal() {
  return async (post) => {
    await animateDemoParticleToFeed(post?.persona ?? null);
  };
}

/** Frame for the demo descent: a smooth ease-in-out drop with a gentle sway. */
export function computeDemoParticleFrame({ progress, sourceRect, targetRect }) {
  const sx = sourceRect.x + sourceRect.width / 2;
  const sy = sourceRect.y + sourceRect.height / 2;
  const tx = targetRect.x + targetRect.width / 2;
  const ty = targetRect.y + targetRect.height / 2;

  const p = Math.max(0, Math.min(progress, 1));
  const t = easeInOutCubic(p);
  const sway = Math.sin(p * Math.PI) * 18;
  return { x: sx + (tx - sx) * t + sway, y: sy + (ty - sy) * t, opacity: 1 };
}

export function computeGenerationParticleFrame({
  progress,
  sourceRect,
  targetRect,
}) {
  const sx = sourceRect.x + sourceRect.width / 2;
  const sy = sourceRect.y + sourceRect.height / 2;
  const tx = targetRect.x + targetRect.width / 2;
  const ty = targetRect.y + targetRect.height / 2;
  const dx = tx - sx;
  const dy = ty - sy;

  const uncapped = -Math.min(Math.abs(dx) * 0.45, 180) - 60;
  const TOP_MARGIN = 16;
  const yAtPeak = sy + dy * EASE_AT_HALF;
  const arcHeight = Math.max(uncapped, TOP_MARGIN - yAtPeak);

  const t = easeOutCubic(Math.max(0, Math.min(progress, 1)));
  const x = sx + dx * t;
  const arcY = arcHeight * Math.sin(Math.PI * progress);
  const y = sy + dy * t + arcY;

  // Flight stays fully opaque; the impact burst owns the fade (CSS-driven).
  return { x, y, opacity: 1 };
}
