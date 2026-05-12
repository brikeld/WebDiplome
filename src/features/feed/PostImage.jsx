import { useEffect, useState } from 'react';
import { ditherMonochromeFromUrl, FX_DEFAULTS } from '@/lib/postImageFx.js';
import '../../styles/postImage.css';

export default function PostImage({ asset, src: rawSrc, alt: rawAlt, accentColor }) {
  const src = asset?.url ?? rawSrc ?? '';
  const alt = rawAlt ?? asset?.filename ?? '';
  const [processedSrc, setProcessedSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProcessedSrc(null);
    ditherMonochromeFromUrl({
      src,
      accentColor,
      ...FX_DEFAULTS,
    })
      .then((u) => {
        if (!cancelled) setProcessedSrc(u);
      })
      .catch(() => {
        if (!cancelled) setProcessedSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src, accentColor]);

  return (
    <div className="post-attachment-block post-image-halftone">
      <img
        className="post-attachment-img"
        src={processedSrc || src}
        alt={alt || ''}
        loading="lazy"
      />
    </div>
  );
}
