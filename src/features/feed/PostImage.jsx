import '../../styles/postImage.css';

export default function PostImage({ src, alt, accentColor }) {
  return (
    <div
      className="post-attachment-block post-image-fx"
      style={{ '--fx-color': accentColor }}
    >
      <img
        className="post-attachment-img"
        src={src}
        alt={alt || ''}
        loading="lazy"
      />
    </div>
  );
}
