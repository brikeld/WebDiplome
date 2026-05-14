import Comment from './Comment.jsx';

export default function UserComment({
  persona,
  content,
  displayName,
  handle,
  avatarSrc,
  avatarInitials,
}) {
  return (
    <Comment
      persona={persona}
      content={content}
      pills={['text', 'text', 'text']} // per spec: placeholder labels for the mockup phase
      displayName={displayName}
      handle={handle}
      avatarSrc={avatarSrc}
      avatarInitials={avatarInitials}
      staggerIndex={0}
    />
  );
}
