import { useRef, useCallback } from 'react';
import { useResume } from '../context/ResumeContext';
import { DN_COLORS } from '../theme/tokens';

interface ColumnDividerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  defaultSplit: number;
  min?: number;
  max?: number;
}

export function useColumnSplit(defaultSplit: number) {
  const { data } = useResume();
  return (data.settings as Record<string, unknown>)?.columnSplit as number | undefined ?? defaultSplit;
}

export default function ColumnDivider({ containerRef, defaultSplit, min = 25, max = 75 }: ColumnDividerProps) {
  const { editMode, update, data } = useResume();
  const dragging = useRef(false);
  const accent = data.settings?.accentColor || DN_COLORS.primary;
  const split = useColumnSplit(defaultSplit);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.round(Math.max(min, Math.min(max, pct)));
    update(d => {
      if (!d.settings) d.settings = { theme: 'dn', showLogo: true, accentColor: DN_COLORS.primary, hiddenSections: [''] };
      (d.settings as Record<string, unknown>).columnSplit = clamped;
    });
  }, [containerRef, min, max, update]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!editMode) return null;

  return (
    <div
      className="no-print"
      style={{
        position: 'absolute',
        left: `${split}%`,
        top: 0,
        bottom: 0,
        width: '14px',
        marginLeft: '-7px',
        cursor: 'col-resize',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseEnter={e => { if (!dragging.current) e.currentTarget.style.background = `${accent}18`; }}
      onMouseLeave={e => { if (!dragging.current) e.currentTarget.style.background = 'transparent'; }}
      title="Glisser pour ajuster la largeur des colonnes"
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        opacity: 0.4,
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: accent,
          }} />
        ))}
      </div>
    </div>
  );
}
