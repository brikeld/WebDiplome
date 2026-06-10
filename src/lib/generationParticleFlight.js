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

export const GENERATION_PARTICLE_DURATION_MS = 920;
export const GENERATION_PARTICLE_SIZE = 32;
/** Progress fraction at which the particle "impacts" — resolve fires here, post reveal begins. */
export const GENERATION_PARTICLE_IMPACT_PROGRESS = 0.88;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

// easeOutCubic(0.5) ≈ 0.875 — used for arc-peak clamping below.
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

/** Source: active persona row on the dashboard generating card. */
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

  // Defer by one macrotask so React flushes any pending state updates
  // (e.g., generatingPersona from onNextPostChange) and renders the correct
  // loading-bar colour before the particle appears on screen.
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

  // Moderate arc — less aggressive than before.
  const uncapped = -Math.min(Math.abs(dx) * 0.45, 180) - 60;
  // Arc peak occurs near progress=0.5 where y ≈ sy + dy*EASE_AT_HALF + arcHeight.
  // Clamp so the peak stays at least 16px below the viewport top.
  const TOP_MARGIN = 16;
  const yAtPeak = sy + dy * EASE_AT_HALF;
  const arcHeight = Math.max(uncapped, TOP_MARGIN - yAtPeak);

  const t = easeOutCubic(Math.max(0, Math.min(progress, 1)));
  const x = sx + dx * t;
  const arcY = arcHeight * Math.sin(Math.PI * progress);
  const y = sy + dy * t + arcY;

  // Hold full opacity until just before the impact point, then fade out sharply
  // so the particle "arrives" at full brightness and disappears after the burst.
  const fadeStart = GENERATION_PARTICLE_IMPACT_PROGRESS;
  const opacity = progress > fadeStart
    ? Math.max(0, 1 - (progress - fadeStart) / (1 - fadeStart))
    : 1;
  return { x, y, opacity };
}
