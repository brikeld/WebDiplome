import { PostMetaMagnifierIcon } from './postMetaIcons.jsx';

export default function PostTellMeMoreToggle({
  isActive = false,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className={`post-meta-pill post-meta-pill--tell post-action-btn post-action-btn--tell${isActive ? ' post-action-btn--tell--active' : ''}`}
      aria-label="Tell me more"
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onClick}
    >
      <PostMetaMagnifierIcon />
    </button>
  );
}
