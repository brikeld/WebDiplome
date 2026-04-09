export default function PostCard({ post }) {
  const personaLabel =
    post.persona?.charAt(0).toUpperCase() + post.persona?.slice(1);

  return (
    <div className="post-card" style={{ '--post-accent': post.noteColor }}>
      <div className="post-header">
        <div className="post-avatar" />
        <span className="post-author">{personaLabel}</span>
      </div>
      <div className="post-body">{post.content}</div>
    </div>
  );
}
