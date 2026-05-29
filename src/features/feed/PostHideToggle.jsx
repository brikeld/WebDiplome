import { PostMetaEyeIcon, PostMetaEyeOffIcon } from './postMetaIcons.jsx';

export default function PostHideToggle({ isHidden, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`post-meta-pill post-meta-pill--hide post-action-btn post-action-btn--hide${isHidden ? ' post-action-btn--hide--reveal' : ''}`}
      aria-label={isHidden ? 'Unhide post' : 'Hide post'}
      disabled={disabled}
      onClick={onClick}
    >
      {isHidden ? <PostMetaEyeIcon /> : <PostMetaEyeOffIcon />}
    </button>
  );
}
