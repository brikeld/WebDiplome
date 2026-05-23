import { useEffect, useRef, useState } from 'react';
import { FX_DEFAULTS, tintChartStyleFromCanvas } from '@/lib/postImageFx.js';
import { pdfjsLib } from '@/lib/pdfjsClient.js';
import PostDocument from './PostDocument.jsx';
import '../../styles/postImage.css';

const PDF_RENDER_MAX_WIDTH = 1920;

function basenameOf(filename) {
  return String(filename || '').split('/').pop();
}

/**
 * Inline PDF preview: first page only, chart-style tint (persona bg, black content).
 */
export default function PostPdfCarousel({ asset, accentColor }) {
  const url = asset?.url ?? '';
  const label = basenameOf(asset?.filename);
  const [displaySrc, setDisplaySrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fatalError, setFatalError] = useState(false);

  const renderGenRef = useRef(0);

  const maxRenderWidth = FX_DEFAULTS.maxWidth > 0 ? FX_DEFAULTS.maxWidth : PDF_RENDER_MAX_WIDTH;

  useEffect(() => {
    let cancelled = false;
    renderGenRef.current += 1;
    const gen = renderGenRef.current;

    setFatalError(false);
    setDisplaySrc(null);
    setLoading(Boolean(url));

    if (!url) {
      setFatalError(true);
      setLoading(false);
      return undefined;
    }

    const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });

    loadingTask.promise
      .then(async (pdf) => {
        if (cancelled || renderGenRef.current !== gen) {
          pdf.destroy().catch(() => {});
          return;
        }

        const page = await pdf.getPage(1);
        const baseVp = page.getViewport({ scale: 1 });
        const scale = Math.min(2.5, Math.max(0.5, maxRenderWidth / baseVp.width));
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no-canvas');

        await page.render({ canvasContext: ctx, viewport }).promise;
        pdf.destroy().catch(() => {});

        if (cancelled || renderGenRef.current !== gen) return;

        const tinted = tintChartStyleFromCanvas(canvas, accentColor);
        setDisplaySrc(tinted);
      })
      .catch(() => {
        if (!cancelled && renderGenRef.current === gen) setFatalError(true);
      })
      .finally(() => {
        if (!cancelled && renderGenRef.current === gen) setLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy().catch(() => {});
    };
  }, [url, accentColor, maxRenderWidth]);

  if (fatalError || !url) {
    return <PostDocument asset={asset} />;
  }

  return (
    <div
      className="post-attachment-block post-image-plain post-pdf-carousel"
      style={{ '--post-accent': accentColor }}
    >
      <div className="post-pdf-carousel__frame">
        {!displaySrc ? (
          <div className="post-pdf-carousel__placeholder" aria-hidden>
            <span className="post-pdf-carousel__placeholder-label">pdf</span>
          </div>
        ) : (
          <img className="post-attachment-img" src={displaySrc} alt={label || 'PDF'} />
        )}
        {loading ? <div className="post-pdf-carousel__loading" aria-hidden /> : null}
      </div>
    </div>
  );
}
