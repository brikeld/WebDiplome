import Comment from './Comment.jsx';

export default function UserComment({
  persona,
  content,
  displayName,
  handle,
  avatarSrc,
  avatarInitials,
  metaLeft,
  metaCenter,
  showMeta = true,
}) {
  return (
    <Comment
      persona={persona}
      content={content}
      displayName={displayName}
      handle={handle}
      avatarSrc={avatarSrc}
      avatarInitials={avatarInitials}
      metaLeft={metaLeft}
      metaCenter={metaCenter}
      staggerIndex={0}
      showMeta={showMeta}
    />
  );
}
