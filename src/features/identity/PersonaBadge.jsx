import { getPersonaBadgeModel } from '@/lib/profileUtils.js';

export default function PersonaBadge({
  profile,
  persona,
  className = '',
}) {
  const model = getPersonaBadgeModel(persona ?? profile ?? null);

  return (
    <span
      className={`persona-badge persona-badge--${model.key}${className ? ` ${className}` : ''}`}
      style={{ '--persona-badge-color': model.color }}
      title={`${model.label} persona`}
      aria-label={`${model.label} persona badge`}
    >
      <span className="persona-badge__glyph" aria-hidden>
        {model.glyph}
      </span>
    </span>
  );
}
