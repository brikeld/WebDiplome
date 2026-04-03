export default function PostCard({ post }) {
  const isDark = post.noteColor === '#2323FF' || post.noteColor === '#FF4E00';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const subtleText = isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.7)';
  const noteText = isDark ? 'rgba(255,255,255,0.9)' : '#000000';

  return (
    <div className="post-card" style={{ background: post.noteColor, color: textColor }}>
      <div className="post-header">
        <div className="post-avatar" />
        <span className="post-author">Brikeld Hoxha</span>
        <span className="post-handle" style={{ color: subtleText }}>
          @il mio MacBook
        </span>
        <span className="post-time" style={{ color: subtleText }}>
          {post.time}
        </span>
      </div>
      <div className="post-body">{post.text}</div>
      <div className="post-system-note" style={{ color: noteText }}>
        {post.systemNote}
      </div>
      {post.hasImage && <div className="post-image">POST CONTENT</div>}
      <div className="post-footer" style={{ color: subtleText }}>
        <span>&hearts; {post.likes}</span>
        <span>&#x1F4AC; {post.comments}</span>
        <span className="views">&#x1F441; {post.views}</span>
      </div>
    </div>
  );
}

