import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { generateClient } from 'aws-amplify/data';
import { uploadData, downloadData } from 'aws-amplify/storage';
import { ResumeProvider, useResume, type ResumeData } from './context/ResumeContext';
import CV from './components/CV';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Schema } from '../amplify/data/resource';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc as string;

const client = generateClient<Schema>();

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
function Toolbar({
  printScale,
  onPrint,
  onSave,
  saveLoading,
  signOut,
}: {
  printScale: number;
  onPrint: () => void;
  onSave: () => void;
  saveLoading: boolean;
  signOut: () => void;
}) {
  const { editMode, setEditMode, downloadJSON, resetData, loadData } = useResume();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePdfImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPdfLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageTexts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pageTexts.push(
          content.items.filter((item): item is TextItem => 'str' in item).map((item) => item.str).join(' ')
        );
      }
      const { data: result, errors } = await client.queries.parsePdf({ pdfText: pageTexts.join('\n\n') });
      if (errors?.length) throw new Error(errors[0].message);
      const parsed = JSON.parse(result!) as ResumeData;
      loadData(parsed);
    } catch (err) {
      alert(`Erreur import PDF : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setPdfLoading(false);
    }
  };

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

        <button onClick={onSave} disabled={saveLoading} title="Sauvegarder sur le cloud" style={{
          background: 'rgba(255,255,255,0.15)', color: 'white',
          border: '1px solid rgba(255,255,255,0.4)',
          padding: '7px 14px', borderRadius: '8px',
          fontSize: '13px', cursor: saveLoading ? 'wait' : 'pointer',
          fontFamily: 'inherit', opacity: saveLoading ? 0.65 : 1,
        }}>
          {saveLoading ? '⏳ Sauvegarde…' : '💾 Sauvegarder'}
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

        <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={(e) => { void handlePdfImport(e); }} />
        <button onClick={() => pdfRef.current?.click()} disabled={pdfLoading}
          title="Importer un CV PDF" style={{
            background: 'rgba(255,255,255,0.15)', color: 'white',
            border: '1px solid rgba(255,255,255,0.4)',
            padding: '7px 12px', borderRadius: '8px',
            fontSize: '13px', cursor: pdfLoading ? 'wait' : 'pointer',
            fontFamily: 'inherit', opacity: pdfLoading ? 0.65 : 1,
          }}>
          {pdfLoading ? '⏳ Analyse…' : '⬆ PDF'}
        </button>

        <button onClick={resetData} title="Réinitialiser les données" style={{
          background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '7px 10px', borderRadius: '8px',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ↺
        </button>

        <button onClick={signOut} title="Se déconnecter" style={{
          background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '7px 12px', borderRadius: '8px',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ⬪ Déconnexion
        </button>
      </div>
    </div>
  );
}

// ── Helpers de scaling ────────────────────────────────────────────────────────
function getElements() {
  return {
    page: document.querySelector('.cv-page') as HTMLElement | null,
    wrapper: document.getElementById('cv-wrapper') as HTMLElement | null,
  };
}

function applyScale() {
  const { page, wrapper } = getElements();
  if (!page || !wrapper) return 1;

  page.style.removeProperty('transform');
  page.style.removeProperty('transform-origin');
  wrapper.style.removeProperty('height');
  wrapper.style.removeProperty('overflow');
  void page.offsetHeight;

  const a4H = page.offsetWidth * (297 / 210);
  const contentH = page.scrollHeight;

  if (contentH <= a4H) return 1;

  const s = (a4H * 0.97) / contentH;
  page.style.transform = `scale(${s})`;
  page.style.transformOrigin = 'top center';
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
  const { data, loadData } = useResume();
  const { signOut } = useAuthenticator();
  const [printScale, setPrintScale] = useState(1);
  const [saveLoading, setSaveLoading] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  // Auto-load depuis S3 au premier montage (après auth)
  useEffect(() => {
    let cancelled = false;
    async function loadFromS3() {
      try {
        const res = await downloadData({
          path: ({ identityId }) => `private/${identityId}/resume.json`,
        }).result;
        if (cancelled) return;
        const text = await res.body.text();
        loadData(JSON.parse(text) as ResumeData);
      } catch {
        // Pas de fichier S3 → conserver les données localStorage/défaut
      } finally {
        if (!cancelled) setCloudLoaded(true);
      }
    }
    void loadFromS3();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    setSaveLoading(true);
    try {
      await uploadData({
        path: ({ identityId }) => `private/${identityId}/resume.json`,
        data: JSON.stringify(data, null, 2),
        options: { contentType: 'application/json' },
      }).result;
      alert('CV sauvegardé !');
    } catch (err) {
      alert(`Erreur sauvegarde : ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaveLoading(false);
    }
  }, [data]);

  // Badge live
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

  const handlePrint = () => {
    applyScale();
    void document.getElementById('cv-wrapper')?.offsetHeight;
    setTimeout(() => window.print(), 60);
  };

  if (!cloudLoaded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#ddd',
        fontFamily: "'Inter', sans-serif", fontSize: '16px', color: '#555',
      }}>
        Chargement du CV…
      </div>
    );
  }

  return (
    <>
      <Toolbar
        printScale={printScale}
        onPrint={handlePrint}
        onSave={() => { void handleSave(); }}
        saveLoading={saveLoading}
        signOut={signOut}
      />
      <div className="cv-outer-wrapper" style={{ paddingTop: '68px', paddingBottom: '40px', minHeight: '100vh', background: '#ddd' }}>
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
    <Authenticator>
      <ResumeProvider>
        <AppContent />
      </ResumeProvider>
    </Authenticator>
  );
}
