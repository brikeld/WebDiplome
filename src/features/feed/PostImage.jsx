import { useEffect, useState } from 'react';
import { ditherMonochromeFromUrl, FX_DEFAULTS } from '@/lib/postImageFx.js';
import '../../styles/postImage.css';

export default function PostImage({ asset, src: rawSrc, alt: rawAlt, accentColor, applyFx = true }) {
  const src = asset?.url ?? rawSrc ?? '';
  const alt = rawAlt ?? asset?.filename ?? '';
  const [processedSrc, setProcessedSrc] = useState(null);

  useEffect(() => {
    if (!applyFx) {
      setProcessedSrc(null);
      return undefined;
    }
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
  }, [src, accentColor, applyFx]);

  const blockClass = applyFx ? 'post-image-halftone' : 'post-image-plain';

  return (
    <div className={`post-attachment-block ${blockClass}`}>
      <img
        className="post-attachment-img"
        src={processedSrc || src}
        alt={alt || ''}
        loading="lazy"
      />
    </div>
  );
}
