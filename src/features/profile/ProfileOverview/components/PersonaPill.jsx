import { personaUiColor } from '@/lib/personaColors.js';

/**
 * High-contrast chip that sits on top of persona-colored capsules.
 * Renders as a dark "ink" tag so it never blends into the card surface.
 * `personaKey` only tints the optional leading dot.
 */
export default function PersonaPill({ personaKey, children, dot = false, className = '' }) {
  return (
    <span className={`po-chip${className ? ` ${className}` : ''}`}>
      {dot ? <span className="po-chip-dot" style={{ background: personaUiColor(personaKey) }} /> : null}
      {children}
    </span>
  );
}
