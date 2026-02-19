import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Bold, Italic, Underline, RemoveFormatting } from 'lucide-react';
import { useResume } from '../context/ResumeContext';

export function FormatToolbar() {
  const { editMode } = useResume();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!editMode) { setPos(null); return; }

    const check = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : (range.startContainer as Element);
      if (!node?.closest('[contenteditable="true"]')) {
        setPos(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY - 46 });
    };

    document.addEventListener('selectionchange', check);
    return () => document.removeEventListener('selectionchange', check);
  }, [editMode]);

  if (!pos || !editMode) return null;

  const exec = (cmd: string) => document.execCommand(cmd, false);

  const Btn = ({ cmd, title, Icon }: { cmd: string; title: string; Icon: React.ComponentType<{ size: number }> }) => (
    <button
      onMouseDown={e => { e.preventDefault(); exec(cmd); }}
      title={title}
      style={{
        background: 'none', border: 'none', color: 'white',
        padding: '5px 8px', cursor: 'pointer', borderRadius: '5px',
        display: 'flex', alignItems: 'center', lineHeight: 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      <Icon size={13} />
    </button>
  );

  return createPortal(
    <div style={{
      position: 'absolute', top: pos.y, left: pos.x,
      transform: 'translateX(-50%)',
      background: '#2d1b36',
      borderRadius: '8px', padding: '3px',
      display: 'flex', gap: '1px', alignItems: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      zIndex: 9999,
      pointerEvents: 'auto',
      userSelect: 'none',
    }}>
      <Btn cmd="bold" title="Gras (Ctrl+B)" Icon={Bold} />
      <Btn cmd="italic" title="Italique (Ctrl+I)" Icon={Italic} />
      <Btn cmd="underline" title="Souligné (Ctrl+U)" Icon={Underline} />
      <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', height: '18px', margin: '0 2px' }} />
      <Btn cmd="removeFormat" title="Supprimer la mise en forme" Icon={RemoveFormatting} />
    </div>,
    document.body
  );
}
