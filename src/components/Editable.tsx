import React, { useRef, useEffect, type CSSProperties, type ReactNode } from 'react';
import { useResume } from '../context/ResumeContext';

// ── EditableText ──────────────────────────────────────────────────────────────
// In view mode: renders HTML via dangerouslySetInnerHTML.
// In edit mode: contentEditable, preserving rich text (bold/italic/underline).
interface EditableTextProps {
  value: string;
  onChange: (html: string) => void;
  as?: string;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
}

export function EditableText({ value, onChange, as: Tag = 'span', className, style }: EditableTextProps) {
  const { editMode } = useResume();
  const ref = useRef<HTMLElement>(null);
  const Elem = Tag as 'span';

  // Sync external value when not focused (e.g. after reset)
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) {
      el.innerHTML = value;
    }
  }, [value, editMode]);

  if (!editMode) {
    return <Elem className={className} style={style} dangerouslySetInnerHTML={{ __html: value }} />;
  }

  return (
    <Elem
      ref={ref as React.RefObject<HTMLSpanElement>}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={style}
      onBlur={e => {
        const html = e.currentTarget.innerHTML ?? '';
        if (html !== value) onChange(html);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
    >
      {/* content set via ref in useEffect */}
    </Elem>
  );
}

// ── EditableList ──────────────────────────────────────────────────────────────
interface EditableListProps {
  items: string[];
  onChangeItem: (index: number, val: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  renderItem: (item: string, index: number, editable: ReactNode) => ReactNode;
  addLabel?: string;
}

export function EditableList({ items, onChangeItem, onAddItem, onRemoveItem, renderItem, addLabel = 'Ajouter' }: EditableListProps) {
  const { editMode } = useResume();

  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="edit-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '3px' }}>
          <div style={{ flex: 1 }}>
            {renderItem(
              item, i,
              <EditableText value={item} onChange={v => onChangeItem(i, v)} />
            )}
          </div>
          {editMode && (
            <button
              className="edit-btn-remove"
              onClick={() => onRemoveItem(i)}
              title="Supprimer"
              style={{ color: '#cc3333', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', marginTop: '1px', flexShrink: 0 }}
            >✕</button>
          )}
        </div>
      ))}
      {editMode && (
        <div style={{ marginTop: '4px' }}>
          <button
            onClick={onAddItem}
            style={{
              fontSize: '9.5px', color: '#7B2882',
              background: 'rgba(123,40,130,0.07)',
              border: '1px dashed #7B2882',
              borderRadius: '4px', padding: '2px 8px', cursor: 'pointer',
            }}
          >
            + {addLabel}
          </button>
        </div>
      )}
    </>
  );
}
