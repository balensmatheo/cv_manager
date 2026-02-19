import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { ResumeProvider, useResume, type ResumeData } from './context/ResumeContext';
import CV from './components/CV';

const P = '#7B2882';

// ── Scale badge ───────────────────────────────────────────────────────────────
function ScaleBadge({ scale }: { scale: number }) {
  if (scale >= 0.999) return null;
  const pct = Math.round(scale * 100);
  const color = pct >= 90 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{
      background: 'rgba(255,255,255,0.15)',
      border: `1px solid ${color}`,
      color: 'white', borderRadius: '10px',
      padding: '2px 9px', fontSize: '11px', fontWeight: 600,
    }}>
      ⚙ PDF : {pct}%
    </span>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
function Toolbar({ printScale, onPrint }: { printScale: number; onPrint: () => void }) {
  const { editMode, setEditMode, downloadJSON, resetData, loadData } = useResume();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as ResumeData;
        loadData(parsed);
      } catch {
        alert('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="no-print" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: `linear-gradient(135deg, ${P} 0%, #9B3AA8 100%)`,
      color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: '52px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src="/logo-dn.png" alt="" style={{ height: '30px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        <span style={{ fontWeight: 600, fontSize: '14px', opacity: 0.9 }}>CV Manager</span>
        {editMode && (
          <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '2px 10px', fontSize: '11px', fontWeight: 600 }}>
            ✏️ Mode Édition
          </span>
        )}
        <ScaleBadge scale={printScale} />
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button onClick={() => setEditMode(!editMode)} style={{
          background: editMode ? 'white' : 'rgba(255,255,255,0.15)',
          color: editMode ? P : 'white',
          border: editMode ? 'none' : '1px solid rgba(255,255,255,0.4)',
          padding: '7px 16px', borderRadius: '8px',
          fontWeight: 600, fontSize: '13px', cursor: 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          {editMode ? '✅ Terminer' : '✏️ Modifier le CV'}
        </button>

        <button onClick={onPrint} style={{
          background: 'white', color: P,
          border: 'none', padding: '7px 16px', borderRadius: '8px',
          fontWeight: 600, fontSize: '13px', cursor: 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}>
          📄 PDF
        </button>

        <button onClick={downloadJSON} title="Télécharger resume.json" style={{
          background: 'rgba(255,255,255,0.15)', color: 'white',
          border: '1px solid rgba(255,255,255,0.4)',
          padding: '7px 12px', borderRadius: '8px',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ⬇ JSON
        </button>

        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        <button onClick={() => fileRef.current?.click()} title="Importer un resume.json" style={{
          background: 'rgba(255,255,255,0.15)', color: 'white',
          border: '1px solid rgba(255,255,255,0.4)',
          padding: '7px 12px', borderRadius: '8px',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ⬆ JSON
        </button>

        <button onClick={resetData} title="Réinitialiser les données" style={{
          background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '7px 10px', borderRadius: '8px',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ↺
        </button>
      </div>
    </div>
  );
}

// ── Helpers de scaling ────────────────────────────────────────────────────────
// transform: scale() ne change PAS la largeur de layout → pas de reflow de texte.
// Le wrapper contrôle la hauteur de pagination (= a4H), overflow: hidden coupe le reste.

function getElements() {
  return {
    page: document.querySelector('.cv-page') as HTMLElement | null,
    wrapper: document.getElementById('cv-wrapper') as HTMLElement | null,
  };
}

function applyScale() {
  const { page, wrapper } = getElements();
  if (!page || !wrapper) return 1;

  // Réinitialise d'abord pour mesurer la hauteur naturelle
  page.style.removeProperty('transform');
  page.style.removeProperty('transform-origin');
  wrapper.style.removeProperty('height');
  wrapper.style.removeProperty('overflow');
  void page.offsetHeight; // force reflow

  const a4H = page.offsetWidth * (297 / 210); // 297mm en px relatif à la largeur A4
  const contentH = page.scrollHeight;          // hauteur réelle du contenu

  if (contentH <= a4H) return 1;

  // transform: scale préserve la largeur CSS → le texte ne se rewrap PAS
  const s = (a4H * 0.97) / contentH;
  page.style.transform = `scale(${s})`;
  page.style.transformOrigin = 'top center';
  // Le wrapper contrôle la pagination : le browser voit contentH*s < a4H
  wrapper.style.height = `${contentH * s}px`;
  wrapper.style.overflow = 'hidden';

  return s;
}

function resetScale() {
  const { page, wrapper } = getElements();
  page?.style.removeProperty('transform');
  page?.style.removeProperty('transform-origin');
  if (wrapper) { wrapper.style.removeProperty('height'); wrapper.style.removeProperty('overflow'); }
}

// ── AppContent ────────────────────────────────────────────────────────────────
function AppContent() {
  const { data } = useResume();
  const [printScale, setPrintScale] = useState(1);

  // Badge live (mesure sans toucher au transform)
  const updateBadge = useCallback(() => {
    const page = document.querySelector('.cv-page') as HTMLElement | null;
    if (!page) return;
    const a4H = page.offsetWidth * (297 / 210);
    const h = page.scrollHeight;
    setPrintScale(h > a4H ? (a4H * 0.97) / h : 1);
  }, []);

  useEffect(() => {
    const t = setTimeout(updateBadge, 60);
    const page = document.querySelector('.cv-page');
    const obs = new ResizeObserver(updateBadge);
    if (page) obs.observe(page);
    return () => { clearTimeout(t); obs.disconnect(); };
  }, [data, updateBadge]);

  // Ctrl+P : beforeprint/afterprint pour Ctrl+P natif
  useEffect(() => {
    const before = () => applyScale();
    const after = () => { resetScale(); updateBadge(); };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [updateBadge]);

  // Bouton PDF : applique le scale puis déclenche l'impression
  const handlePrint = () => {
    applyScale();
    void document.getElementById('cv-wrapper')?.offsetHeight; // flush
    setTimeout(() => window.print(), 60);
  };

  return (
    <>
      <Toolbar printScale={printScale} onPrint={handlePrint} />
      <div className="cv-outer-wrapper" style={{ paddingTop: '68px', paddingBottom: '40px', minHeight: '100vh', background: '#ddd' }}>
        {/* cv-wrapper : height contrôlé par JS au moment de l'impression */}
        <div id="cv-wrapper">
          <CV />
        </div>
      </div>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ResumeProvider>
      <AppContent />
    </ResumeProvider>
  );
}
