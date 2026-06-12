import { personaUiColor } from '@/lib/personaColors.js';

/**
 * Static capsule shell for the profile overview. Everything is always
 * visible — no folds, modals, or click targets on this screen.
 * `meta` renders as a small right-aligned figure in the header.
 */
export default function PoCard({
  eyebrow,
  title,
  meta,
  persona = 'productivity',
  className = '',
  children,
}) {
  const accent = personaUiColor(persona);

  return (
    <section
      className={['po-card', `po-card--${persona}`, className].filter(Boolean).join(' ')}
      style={{ '--po-accent': accent, '--po-card-fill': accent }}
    >
      <header className="po-card-head">
        <span className="po-card-headings">
          {eyebrow ? <span className="po-card-eyebrow">{eyebrow}</span> : null}
          <span className="po-card-title">{title}</span>
        </span>
        {meta ? <span className="po-card-meta">{meta}</span> : null}
      </header>

      {children}
    </section>
  );
}
