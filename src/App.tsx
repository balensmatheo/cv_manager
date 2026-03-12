import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { uploadData, downloadData } from 'aws-amplify/storage';
import { Toaster, toast } from 'sonner';
import { ResumeProvider, useResume, type ResumeData } from './context/ResumeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import CV from './components/CV';
import AuthPage from './components/AuthPage';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
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
      background: '#F9FAFB', border: `1px solid ${color}`,
      color: color, borderRadius: '10px',
      padding: '2px 9px', fontSize: '11px', fontWeight: 600,
    }}>
      PDF : {pct}%
    </span>
  );
}

// ── Scale helpers ─────────────────────────────────────────────────────────────
function getElements() {
  return {
    page:    document.querySelector('.cv-page') as HTMLElement | null,
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

// ── Usage badge ──────────────────────────────────────────────────────────────
function UsageBadge() {
  const [usage, setUsage] = useState<{ invocationsRemaining: number; invocationsLimit: number } | null>(null);
  useEffect(() => {
    void client.queries.getUsage({}).then(({ data: result }) => {
      if (result) setUsage(JSON.parse(result) as { invocationsRemaining: number; invocationsLimit: number });
    }).catch(() => {});
  }, []);
  if (!usage) return null;
  const color = usage.invocationsRemaining === 0 ? '#ef4444' : usage.invocationsRemaining <= 2 ? '#f59e0b' : '#6B7280';
  return (
    <span style={{
      fontSize: '11px', color, fontWeight: 600,
      padding: '4px 10px', borderRadius: '8px',
      background: '#F3F4F6', border: `1px solid ${color}20`,
    }}>
      {usage.invocationsRemaining}/{usage.invocationsLimit} imports
    </span>
  );
}

// ── CvToolbar ─────────────────────────────────────────────────────────────────
function CvToolbar({
  printScale, onPrint, onSave, saveLoading,
}: {
  printScale: number; onPrint: () => void;
  onSave: () => void; saveLoading: boolean;
}) {
  const { editMode, setEditMode, downloadJSON, resetData, loadData } = useResume();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef  = useRef<HTMLInputElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePdfImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type && file.type !== 'application/pdf') {
      toast.error('Veuillez sélectionner un fichier PDF valide.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 10 Mo).');
      return;
    }
    setPdfLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (pdf.numPages > 30) {
        toast.error(`Le PDF contient trop de pages (${pdf.numPages}). Maximum : 30.`);
        return;
      }
      const pageTexts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        pageTexts.push(
          content.items
            .filter((item): item is TextItem => 'str' in item)
            .map(item => item.str)
            .join(' ')
        );
      }
      const { data: result, errors } = await client.queries.parsePdf({ pdfText: pageTexts.join('\n\n') });
      if (errors?.length) throw new Error(errors[0].message);
      if (!result) throw new Error('Réponse vide du serveur');
      let parsed: ResumeData;
      try { parsed = JSON.parse(result) as ResumeData; }
      catch { throw new Error('Le parsing du CV a retourné un format invalide'); }
      loadData(parsed);
      toast.success('CV importé avec succès');
    } catch (err) {
      toast.error(`Erreur import PDF : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        loadData(JSON.parse(ev.target?.result as string) as ResumeData);
        toast.success('JSON importé');
      } catch { toast.error('Fichier JSON invalide'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const btn = (label: string, onClick: () => void, opts?: {
    active?: boolean; disabled?: boolean; title?: string;
  }) => (
    <button
      onClick={onClick} disabled={opts?.disabled} title={opts?.title}
      style={{
        background: opts?.active ? P : 'white',
        color: opts?.active ? 'white' : '#374151',
        border: '1px solid #E5E7EB',
        padding: '7px 14px', borderRadius: '8px',
        fontWeight: 600, fontSize: '13px',
        cursor: opts?.disabled ? 'wait' : 'pointer',
        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px',
        opacity: opts?.disabled ? 0.65 : 1,
        whiteSpace: 'nowrap' as const,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="no-print" style={{
      background: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px',
      borderBottom: '1px solid #E5E7EB',
      fontFamily: "'Inter', sans-serif",
      flexWrap: 'wrap' as const, gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => setEditMode(!editMode)} style={{
          background: editMode ? P : 'white',
          color: editMode ? 'white' : '#374151',
          border: editMode ? 'none' : '1px solid #E5E7EB',
          padding: '7px 14px', borderRadius: '8px',
          fontWeight: 600, fontSize: '13px', cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          {editMode ? 'Terminer' : 'Modifier'}
        </button>
        <ScaleBadge scale={printScale} />
      </div>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
        {btn('PDF', onPrint)}
        {btn(saveLoading ? 'Sauvegarde…' : 'Sauvegarder', onSave, { disabled: saveLoading })}
        {btn('Export JSON', downloadJSON)}

        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        {btn('Import JSON', () => fileRef.current?.click())}

        <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={e => { void handlePdfImport(e); }} />
        {btn(pdfLoading ? 'Analyse…' : 'Import PDF', () => pdfRef.current?.click(), { disabled: pdfLoading })}
        <UsageBadge />

        <button onClick={resetData} title="Réinitialiser" style={{
          background: 'white', color: '#9CA3AF',
          border: '1px solid #E5E7EB',
          padding: '7px 10px', borderRadius: '8px',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>↺</button>
      </div>
    </div>
  );
}

// ── CvPage ───────────────────────────────────────────────────────────────────
function CvPage() {
  const { data, loadData } = useResume();
  const [printScale, setPrintScale] = useState(1);
  const [saveLoading, setSaveLoading] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await downloadData({
          path: ({ identityId }) => `private/${identityId}/resume.json`,
        }).result;
        if (cancelled) return;
        const text = await res.body.text();
        const parsed = JSON.parse(text) as ResumeData;
        loadData(parsed);
      } catch { /* no S3 file or invalid JSON → keep defaults */ }
      finally { if (!cancelled) setCloudLoaded(true); }
    })();
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
      toast.success('CV sauvegardé !');
    } catch (err) {
      toast.error(`Erreur sauvegarde : ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaveLoading(false);
    }
  }, [data]);

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
    const after  = () => { resetScale(); updateBadge(); };
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
        minHeight: '60vh',
        fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#9CA3AF',
      }}>
        Chargement du CV…
      </div>
    );
  }

  return (
    <>
      <CvToolbar
        printScale={printScale}
        onPrint={handlePrint}
        onSave={() => { void handleSave(); }}
        saveLoading={saveLoading}
      />
      <div className="cv-outer-wrapper" style={{
        paddingTop: '24px', paddingBottom: '40px',
        display: 'flex', justifyContent: 'center',
      }}>
        <div id="cv-wrapper"><CV /></div>
      </div>
    </>
  );
}

// ── Main layout (authenticated) ──────────────────────────────────────────────
function MainLayout() {
  return (
    <ResumeProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{
          marginLeft: '220px', flex: 1, background: '#F3F4F6',
          fontFamily: "'Inter', sans-serif",
        }}>
          <Routes>
            <Route path="/" element={<CvPage />} />
            <Route path="/profile" element={
              <div style={{ padding: '32px' }}><ProfilePage /></div>
            } />
            <Route path="/admin" element={
              <div style={{ padding: '32px' }}><AdminPage /></div>
            } />
          </Routes>
        </main>
      </div>
    </ResumeProvider>
  );
}

// ── Auth-aware layout ─────────────────────────────────────────────────────────
function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, #2D0B3E 0%, ${P} 55%, #9B3AA8 100%)`,
      }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'Inter', sans-serif", fontSize: '14px' }}>
          Chargement…
        </div>
      </div>
    );
  }

  if (user) {
    return <MainLayout />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, #2D0B3E 0%, ${P} 55%, #9B3AA8 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif", padding: '24px',
      position: 'relative' as const, overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-8%', right: '-4%', width: '420px', height: '420px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-12%', left: '-6%', width: '520px', height: '520px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
      <AuthPage onAuthenticated={() => window.location.reload()} />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { fontFamily: "'Inter', sans-serif", fontSize: '13px' },
            }}
          />
          <AuthLayout />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
