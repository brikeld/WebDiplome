import { useCallback, useEffect, useRef, useState } from 'react';
import { ditherMonochromeFromCanvas, FX_DEFAULTS } from '@/lib/postImageFx.js';
import { pdfjsLib } from '@/lib/pdfjsClient.js';
import PostDocument from './PostDocument.jsx';
import '../../styles/postImage.css';

function basenameOf(filename) {
  return String(filename || '').split('/').pop();
}

function Chevron({ dir }) {
  const d = dir === 'next' ? 'M14 6l6 6-6 6' : 'M22 6l-6 6 6 6';
  return (
    <svg width="30" height="52" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Inline PDF preview: rasterize pages with pdf.js, same halftone filter as images.
 * Multi-page: Instagram-style prev/next chevrons + dots.
 */
export default function PostPdfCarousel({ asset, accentColor }) {
  const url = asset?.url ?? '';
  const label = basenameOf(asset?.filename);

  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [processedByPage, setProcessedByPage] = useState(() => (/** @type {Record<number, string>} */ ({})));
  const [pageLoading, setPageLoading] = useState(false);
  const [fatalError, setFatalError] = useState(false);

  const pdfRef = useRef(null);
  const renderGenRef = useRef(0);

  useEffect(() => {
    setProcessedByPage({});
  }, [accentColor]);

  useEffect(() => {
    let cancelled = false;
    setFatalError(false);
    setNumPages(0);
    setPageIndex(0);
    setProcessedByPage({});
    renderGenRef.current += 1;

    const prev = pdfRef.current;
    if (prev) {
      prev.destroy().catch(() => {});
      pdfRef.current = null;
    }

    if (!url) {
      setFatalError(true);
      return undefined;
    }

    const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });
    loadingTask.promise
      .then(async (pdf) => {
        if (cancelled) {
          pdf.destroy().catch(() => {});
          return;
        }
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
      })
      .catch(() => {
        if (!cancelled) setFatalError(true);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy().catch(() => {});
      const doc = pdfRef.current;
      pdfRef.current = null;
      if (doc) doc.destroy().catch(() => {});
    };
  }, [url]);

  const renderPage = useCallback(
    async (pdf, zeroBasedIndex) => {
      const pageNum = zeroBasedIndex + 1;
      const page = await pdf.getPage(pageNum);
      const baseVp = page.getViewport({ scale: 1 });
      const maxW = FX_DEFAULTS.maxWidth;
      const scale = Math.min(2.5, Math.max(0.5, maxW / baseVp.width));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no-canvas');

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const cacheKey = `pdf:${url}#p${pageNum}`;
      return ditherMonochromeFromCanvas({
        canvas,
        cacheKey,
        accentColor,
        ...FX_DEFAULTS,
      });
    },
    [url, accentColor],
  );

  useEffect(() => {
    if (!url || fatalError || numPages === 0) return undefined;
    if (processedByPage[pageIndex]) return undefined;

    const pdf = pdfRef.current;
    if (!pdf) return undefined;

    const gen = ++renderGenRef.current;
    setPageLoading(true);

    renderPage(pdf, pageIndex)
      .then((dataUrl) => {
        if (renderGenRef.current !== gen) return;
        setProcessedByPage((prev) => ({ ...prev, [pageIndex]: dataUrl }));
      })
      .catch(() => {
        if (renderGenRef.current !== gen) return;
        setFatalError(true);
      })
      .finally(() => {
        if (renderGenRef.current === gen) setPageLoading(false);
      });

    return undefined;
  }, [url, fatalError, numPages, pageIndex, processedByPage, renderPage]);

  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPageIndex((i) => Math.min(numPages - 1, i + 1));

  if (fatalError || !url) {
    return <PostDocument asset={asset} />;
  }

  const displaySrc = processedByPage[pageIndex];
  const showNav = numPages > 1;
  const canPrev = showNav && pageIndex > 0;
  const canNext = showNav && pageIndex < numPages - 1;

  return (
    <div className="post-attachment-block post-image-halftone post-pdf-carousel">
      <div className="post-pdf-carousel__frame">
        {!displaySrc && (
          <div className="post-pdf-carousel__placeholder" aria-hidden>
            <span className="post-pdf-carousel__placeholder-label">pdf</span>
          </div>
        )}
        {displaySrc ? (
          <img className="post-attachment-img" src={displaySrc} alt={`${label} page ${pageIndex + 1}`} />
        ) : null}
        {pageLoading ? <div className="post-pdf-carousel__loading" aria-hidden /> : null}

        {canPrev ? (
          <button
            type="button"
            className="post-pdf-carousel__nav post-pdf-carousel__nav--prev"
            style={{ color: accentColor }}
            onClick={goPrev}
            aria-label="Previous page"
          >
            <Chevron dir="prev" />
          </button>
        ) : null}
        {canNext ? (
          <button
            type="button"
            className="post-pdf-carousel__nav post-pdf-carousel__nav--next"
            style={{ color: accentColor }}
            onClick={goNext}
            aria-label="Next page"
          >
            <Chevron dir="next" />
          </button>
        ) : null}

        {showNav ? (
          <div className="post-pdf-carousel__dots" role="tablist" aria-label="PDF pages">
            {Array.from({ length: numPages }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === pageIndex}
                className={`post-pdf-carousel__dot${i === pageIndex ? ' post-pdf-carousel__dot--active' : ''}`}
                onClick={() => setPageIndex(i)}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
