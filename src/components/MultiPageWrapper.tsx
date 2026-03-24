import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

/**
 * MultiPageWrapper
 *
 * Wraps CV content and provides:
 * 1. On-screen visual A4 page boundaries with page numbers
 * 2. Proper CSS print page breaks
 * 3. Page count reporting to parent
 *
 * The content remains a single DOM tree — no cloning.
 * Page boundary lines and page number overlays are added visually.
 */

// A4 at 96 DPI: 210mm = ~793.7px, 297mm = ~1122.5px
const A4_HEIGHT_MM = 297;
const A4_WIDTH_MM = 210;
const A4_RATIO = A4_HEIGHT_MM / A4_WIDTH_MM;

interface Props {
  children: ReactNode;
  onPageCountChange?: (count: number) => void;
  accentColor?: string;
  footerText?: string;
}

export default function MultiPageWrapper({
  children,
  onPageCountChange,
  accentColor = '#894991',
  footerText = '',
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);

  const measure = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const cvPage = el.querySelector('.cv-page') as HTMLElement | null;
    if (!cvPage) return;

    const pageW = cvPage.offsetWidth;
    if (pageW === 0) return;

    const ph = pageW * A4_RATIO;
    setPageHeight(ph);

    const contentH = cvPage.scrollHeight;
    const count = Math.max(1, Math.ceil(contentH / ph));
    setPageCount(count);
    onPageCountChange?.(count);
  }, [onPageCountChange]);

  useEffect(() => {
    const timer = setTimeout(measure, 100);
    const el = wrapperRef.current;
    if (!el) return () => clearTimeout(timer);

    const cvPage = el.querySelector('.cv-page');

    const resizeObs = new ResizeObserver(() => setTimeout(measure, 50));
    if (cvPage) resizeObs.observe(cvPage);
    else resizeObs.observe(el);

    const mutObs = new MutationObserver(() => setTimeout(measure, 50));
    mutObs.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      clearTimeout(timer);
      resizeObs.disconnect();
      mutObs.disconnect();
    };
  }, [measure]);

  // Build page boundary markers (visual only, no-print)
  const markers: ReactNode[] = [];
  if (pageCount > 1 && pageHeight > 0) {
    for (let i = 1; i < pageCount; i++) {
      markers.push(
        <div
          key={`break-${i}`}
          className="no-print page-break-marker"
          style={{
            position: 'absolute',
            top: `${i * pageHeight}px`,
            left: 0,
            right: 0,
            height: 0,
            borderTop: `2px dashed ${accentColor}60`,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <span style={{
            position: 'absolute',
            top: '-10px',
            right: '8px',
            background: accentColor,
            color: 'white',
            fontSize: '9px',
            fontWeight: 700,
            padding: '1px 8px',
            borderRadius: '8px',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.03em',
          }}>
            Page {i + 1}
          </span>
        </div>
      );
    }
  }

  // Page number overlays (one per page, visual + print)
  const pageNumbers: ReactNode[] = [];
  if (pageHeight > 0) {
    for (let i = 0; i < pageCount; i++) {
      pageNumbers.push(
        <div
          key={`pagenum-${i}`}
          className="cv-page-number"
          style={{
            position: 'absolute',
            top: `${i * pageHeight + pageHeight - 24}px`,
            left: 0,
            right: 0,
            height: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 18px',
            zIndex: 11,
            pointerEvents: 'none',
          }}
        >
          <span style={{
            fontSize: '7.5px',
            color: '#999',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.03em',
          }}>
            {footerText}
          </span>
          <span style={{
            fontSize: '7.5px',
            color: '#999',
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.03em',
          }}>
            {i + 1}/{pageCount}
          </span>
        </div>
      );
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {children}
      {markers}
      {pageNumbers}
    </div>
  );
}
