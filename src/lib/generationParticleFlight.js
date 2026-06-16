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

/** Travel time from the generating row to the reserved feed slot. */
export const GENERATION_PARTICLE_FLIGHT_MS = 700;
/** Impact lifetime after landing — core pop + shockwave. Mirror `--burst-ms` in CSS. */
export const GENERATION_PARTICLE_BURST_MS = 500;
export const GENERATION_PARTICLE_SIZE = 32;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
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
        detail: { persona, sourceRect, targetRect, resolve },
      }));
    }, 0);
  });
}

export function createGenerationBeforeReveal() {
  return async (post) => {
    await animateGenerationParticleToFeed(post?.persona ?? null);
  };
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
