import { personaUiColor } from '@/lib/personaColors.js';

/**
 * Capsule shell for the profile overview.
 * mode:
 *  - 'expand'  → header toggles an inline collapsible body (chevron)
 *  - 'detail'  → header opens a focused modal (onOpenDetail)
 *  - 'static'  → no interaction
 */
export default function PoCard({
  eyebrow,
  title,
  persona = 'productivity',
  mode = 'static',
  expanded = false,
  onToggle,
  onOpenDetail,
  className = '',
  children,
}) {
  const accent = personaUiColor(persona);
  const interactive = mode === 'expand' || mode === 'detail';

  const handleActivate = () => {
    if (mode === 'expand') onToggle?.();
    else if (mode === 'detail') onOpenDetail?.();
  };

  const headerProps = interactive
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-expanded': mode === 'expand' ? expanded : undefined,
        onClick: handleActivate,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivate();
          }
        },
      }
    : {};

  return (
    <section
      className={[
        'po-card',
        `po-card--${persona}`,
        interactive ? 'po-card--interactive' : '',
        mode === 'expand' && expanded ? 'po-card--open' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--po-accent': accent, '--po-card-fill': accent }}
    >
      <header className={`po-card-head${interactive ? ' po-card-head--btn' : ''}`} {...headerProps}>
        <span className="po-card-headings">
          {eyebrow ? <span className="po-card-eyebrow">{eyebrow}</span> : null}
          <span className="po-card-title">{title}</span>
        </span>
        {mode === 'expand' ? (
          <span className={`po-card-chevron${expanded ? ' is-open' : ''}`} aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
        {mode === 'detail' ? <span className="po-card-cue" aria-hidden>Details</span> : null}
      </header>

      {children}
    </section>
  );
}

/** Animated collapsible region used inside expand-mode cards. */
export function PoFold({ open, children }) {
  return (
    <div className="po-fold" data-open={open ? 'true' : 'false'}>
      <div className="po-fold-inner">{children}</div>
    </div>
  );
}
