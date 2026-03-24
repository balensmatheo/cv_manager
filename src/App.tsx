import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import { uploadData, downloadData } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Toaster, toast } from 'sonner';
import { ResumeProvider, useResume, type ResumeData } from './context/ResumeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import CV from './components/CV';
import CVClassic from './components/CVClassic';
import AuthPage from './components/AuthPage';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar, { WIDTH_OPEN, WIDTH_CLOSED } from './components/Sidebar';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import DirectoryPage from './pages/DirectoryPage';
import MyCvsPage from './pages/MyCvsPage';
import CvAgent from './components/CvAgent';
import MultiPageWrapper from './components/MultiPageWrapper';
import type { CvMeta } from './pages/MyCvsPage';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Schema } from '../amplify/data/resource';
import { DN_COLORS } from './theme/tokens';
import { ThemeProvider } from './context/ThemeContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc as string;

const client = generateClient<Schema>();

const P = DN_COLORS.primary;

// ── Page count badge ──────────────────────────────────────────────────────────
function PageBadge({ pageCount }: { pageCount: number }) {
  if (pageCount <= 1) return null;
  const color = pageCount <= 2 ? '#6B7280' : pageCount <= 3 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{
      background: '#F9FAFB', border: `1px solid ${color}`,
      color: color, borderRadius: '10px',
      padding: '2px 9px', fontSize: '11px', fontWeight: 600,
    }}>
      {pageCount} pages
    </span>
  );
}

// ── Print helpers ─────────────────────────────────────────────────────────────
// Multi-page: no scaling needed, CSS page breaks handle pagination

// ── Usage badge ──────────────────────────────────────────────────────────────
function UsageBadge() {
  const [usage, setUsage] = useState<{ invocationsRemaining: number; invocationsLimit: number } | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const iid = await getIdentityId();
        const { data: result } = await client.queries.getUsage({ identityId: iid });
        if (result) setUsage(JSON.parse(result) as { invocationsRemaining: number; invocationsLimit: number });
      } catch { /* ignore */ }
    })();
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
  pageCount, onPrint, onSave, saveLoading,
}: {
  pageCount: number; onPrint: () => void;
  onSave: () => void; saveLoading: boolean;
}) {
  const { editMode, setEditMode, downloadJSON, resetData, loadData, data, update } = useResume();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef  = useRef<HTMLInputElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const theme = data.settings?.theme || 'dn';
  const showLogo = data.settings?.showLogo ?? true;
  const accentColor = data.settings?.accentColor || P;

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
        background: opts?.active ? P : 'var(--dn-surface)',
        color: opts?.active ? 'white' : 'var(--dn-text)',
        border: '1px solid var(--dn-divider)',
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
      background: 'var(--dn-surface)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px',
      borderBottom: '1px solid var(--dn-divider)',
      fontFamily: "'Inter', sans-serif",
      flexWrap: 'wrap' as const, gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => setEditMode(!editMode)} style={{
          background: editMode ? P : 'var(--dn-surface)',
          color: editMode ? 'white' : 'var(--dn-text)',
          border: editMode ? 'none' : '1px solid var(--dn-divider)',
          padding: '7px 14px', borderRadius: '8px',
          fontWeight: 600, fontSize: '13px', cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          {editMode ? 'Terminer' : 'Modifier'}
        </button>
        <PageBadge pageCount={pageCount} />
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
          background: 'var(--dn-surface)', color: 'var(--dn-text-secondary)',
          border: '1px solid var(--dn-divider)',
          padding: '7px 10px', borderRadius: '8px',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>↺</button>
      </div>

      {/* ── Theme / Logo / Color controls ── */}
      <div style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
        paddingTop: '8px', borderTop: '1px solid var(--dn-divider)', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--dn-text-secondary)', fontWeight: 600 }}>Mise en page :</span>
        {[
          { id: 'dn', label: 'Decision Network' },
          { id: 'classic', label: 'Classic (sidebar)' },
        ].map(t => (
          <button key={t.id} onClick={() => update(d => {
            if (!d.settings) d.settings = { theme: 'dn', showLogo: true, accentColor: DN_COLORS.primary, hiddenSections: [''] };
            d.settings.theme = t.id;
          })} style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            background: theme === t.id ? accentColor : 'var(--dn-surface)',
            color: theme === t.id ? 'white' : 'var(--dn-text-secondary)',
            border: theme === t.id ? 'none' : '1px solid var(--dn-divider)',
          }}>
            {t.label}
          </button>
        ))}

        <div style={{ width: '1px', height: '20px', background: 'var(--dn-divider)' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--dn-text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" checked={showLogo}
            onChange={e => update(d => {
              if (!d.settings) d.settings = { theme: 'dn', showLogo: true, accentColor: DN_COLORS.primary, hiddenSections: [''] };
              d.settings.showLogo = e.target.checked;
            })}
            style={{ accentColor }} />
          Logo
        </label>

        <div style={{ width: '1px', height: '20px', background: 'var(--dn-divider)' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--dn-text-secondary)', fontWeight: 600 }}>
          Couleur
          <input type="color" value={accentColor}
            onChange={e => update(d => {
              if (!d.settings) d.settings = { theme: 'dn', showLogo: true, accentColor: DN_COLORS.primary, hiddenSections: [''] };
              d.settings.accentColor = e.target.value;
            })}
            style={{ width: '24px', height: '24px', border: '1px solid var(--dn-divider)', borderRadius: '4px', cursor: 'pointer', padding: 0 }} />
        </label>
        {[DN_COLORS.primary, '#C0392B', '#2563EB', '#059669', '#D97706', '#1F2937'].map(c => (
          <button key={c} onClick={() => update(d => {
            if (!d.settings) d.settings = { theme: 'dn', showLogo: true, accentColor: DN_COLORS.primary, hiddenSections: [''] };
            d.settings.accentColor = c;
          })} title={c} style={{
            width: '20px', height: '20px', borderRadius: '50%', border: accentColor === c ? '2px solid var(--dn-text)' : '2px solid transparent',
            background: c, cursor: 'pointer', padding: 0, flexShrink: 0,
          }} />
        ))}

        <div style={{ width: '1px', height: '20px', background: 'var(--dn-divider)' }} />

        <span style={{ fontSize: '11px', color: 'var(--dn-text-secondary)', fontWeight: 600 }}>Sections :</span>
        {[
          { id: 'summary', label: 'Profil' },
          { id: 'profile', label: 'Profil tech.' },
          { id: 'skills', label: 'Compétences' },
          { id: 'education', label: 'Formations' },
          { id: 'interests', label: 'Intérêts' },
        ].map(s => {
          const hiddenSections = data.settings?.hiddenSections || [];
          const visible = !hiddenSections.includes(s.id);
          return (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: visible ? 'var(--dn-text-secondary)' : 'var(--dn-divider)', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={visible}
                onChange={() => update(d => {
                  if (!d.settings) d.settings = { theme: 'dn', showLogo: true, accentColor: DN_COLORS.primary, hiddenSections: [] };
                  if (!d.settings.hiddenSections) d.settings.hiddenSections = [];
                  const idx = d.settings.hiddenSections.indexOf(s.id);
                  if (idx >= 0) d.settings.hiddenSections.splice(idx, 1);
                  else d.settings.hiddenSections.push(s.id);
                })}
                style={{ accentColor }} />
              {s.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── helpers for multi-CV S3 ──────────────────────────────────────────────────
async function getIdentityId(): Promise<string> {
  const session = await fetchAuthSession();
  return session.identityId!;
}

async function loadCvIndex(identityId: string): Promise<CvMeta[]> {
  try {
    const res = await downloadData({ path: `private/${identityId}/cv-index.json` }).result;
    return JSON.parse(await res.body.text()) as CvMeta[];
  } catch { return []; }
}

async function saveCvIndex(identityId: string, index: CvMeta[]) {
  await uploadData({
    path: `private/${identityId}/cv-index.json`,
    data: JSON.stringify(index, null, 2),
    options: { contentType: 'application/json' },
  }).result;
}

// ── CvPage ───────────────────────────────────────────────────────────────────
function CvPage() {
  const { cvId } = useParams<{ cvId: string }>();
  const navigate = useNavigate();
  const { data, loadData } = useResume();
  const [pageCount, setPageCount] = useState(1);
  const [saveLoading, setSaveLoading] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const identityIdRef = useRef('');
  const [cvName, setCvName] = useState('');
  const [cvNameLoaded, setCvNameLoaded] = useState(false);
  const cvNameRef = useRef(cvName);
  cvNameRef.current = cvName;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const iid = await getIdentityId();
        identityIdRef.current = iid;

        if (cvId) {
          // Load specific CV by ID
          const res = await downloadData({ path: `private/${iid}/cvs/${cvId}.json` }).result;
          if (cancelled) return;
          const parsed = JSON.parse(await res.body.text()) as ResumeData;
          loadData(parsed);
          // Load name from index
          const index = await loadCvIndex(iid);
          const meta = index.find(c => c.id === cvId);
          setCvName(meta?.name || 'Sans titre');
          setCvNameLoaded(true);
        } else {
          // Legacy fallback: redirect to /my-cvs
          navigate('/my-cvs', { replace: true });
          return;
        }
      } catch {
        toast.error('CV introuvable');
        navigate('/my-cvs', { replace: true });
        return;
      }
      finally { if (!cancelled) setCloudLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [cvId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCvName = useCallback(async (newName: string) => {
    if (!cvId || !newName.trim()) return;
    try {
      const iid = identityIdRef.current || await getIdentityId();
      const index = await loadCvIndex(iid);
      const exists = index.some(c => c.id === cvId);
      let updated: CvMeta[];
      if (exists) {
        updated = index.map(c => c.id === cvId ? { ...c, name: newName.trim() } : c);
      } else {
        const now = new Date().toISOString();
        updated = [...index, { id: cvId, name: newName.trim(), createdAt: now, updatedAt: now }];
      }
      await saveCvIndex(iid, updated);
    } catch { /* silent — will be saved with next full save */ }
  }, [cvId]);

  const handleSave = useCallback(async () => {
    if (!cvId) return;
    setSaveLoading(true);
    try {
      const iid = identityIdRef.current || await getIdentityId();
      // Save CV data
      await uploadData({
        path: `private/${iid}/cvs/${cvId}.json`,
        data: JSON.stringify(data, null, 2),
        options: { contentType: 'application/json' },
      }).result;
      // Update updatedAt + name in index (add entry if missing)
      const index = await loadCvIndex(iid);
      const now = new Date().toISOString();
      const currentName = cvNameRef.current;
      const exists = index.some(c => c.id === cvId);
      let updated: CvMeta[];
      if (exists) {
        updated = index.map(c => c.id === cvId ? { ...c, name: currentName || c.name, updatedAt: now } : c);
      } else {
        updated = [...index, { id: cvId, name: currentName || 'CV sans nom', createdAt: now, updatedAt: now }];
      }
      await saveCvIndex(iid, updated);
      toast.success('CV sauvegardé !');
    } catch (err) {
      toast.error(`Erreur sauvegarde : ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaveLoading(false);
    }
  }, [data, cvId]);

  const handlePageCountChange = useCallback((count: number) => {
    setPageCount(count);
  }, []);

  const handlePrint = () => {
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
      {/* CV name bar */}
      {cvNameLoaded && (
        <div className="no-print" style={{
          background: 'var(--dn-surface)', borderBottom: '1px solid var(--dn-divider)',
          padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '12px',
          fontFamily: "'Inter', sans-serif",
        }}>
          <button onClick={() => navigate('/my-cvs')} style={{
            background: 'none', border: '1px solid var(--dn-divider)', borderRadius: '6px',
            padding: '4px 10px', fontSize: '12px', color: 'var(--dn-text-secondary)',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            flexShrink: 0,
          }}>
            ← Mes CVs
          </button>
          <input
            value={cvName}
            onChange={e => setCvName(e.target.value)}
            onBlur={() => { if (!cvName.trim()) setCvName('Sans titre'); void saveCvName(cvName.trim() || 'Sans titre'); }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            spellCheck={false}
            style={{
              fontSize: '13px', fontWeight: 700, color: 'var(--dn-text)',
              background: 'transparent', border: '1px solid transparent',
              borderRadius: '6px', padding: '4px 8px',
              fontFamily: 'inherit', outline: 'none',
              transition: 'border-color 0.15s, background 0.15s',
              minWidth: '120px', flex: 1,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--dn-divider)'; e.currentTarget.style.background = 'var(--dn-surface)'; }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
          />
        </div>
      )}
      <CvToolbar
        pageCount={pageCount}
        onPrint={handlePrint}
        onSave={() => { void handleSave(); }}
        saveLoading={saveLoading}
      />
      <div className="cv-outer-wrapper" style={{
        paddingTop: '24px', paddingBottom: '40px',
        display: 'flex', justifyContent: 'center',
      }}>
        <div id="cv-wrapper">
          <MultiPageWrapper
            onPageCountChange={handlePageCountChange}
            accentColor={data.settings?.accentColor || P}
            footerText={data.personal?.website || ''}
          >
            {(data.settings?.theme || 'dn') === 'classic' ? <CVClassic /> : <CV />}
          </MultiPageWrapper>
        </div>
      </div>
      <CvAgent />
    </>
  );
}

// ── Main layout (authenticated) ──────────────────────────────────────────────
function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const sidebarWidth = sidebarCollapsed ? WIDTH_CLOSED : WIDTH_OPEN;

  return (
    <ResumeProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <main style={{
          marginLeft: `${sidebarWidth}px`, flex: 1, background: 'var(--dn-bg)',
          fontFamily: "'Inter', sans-serif",
          transition: 'margin-left 0.2s',
        }}>
          <Routes>
            <Route path="/" element={<MyCvsPage />} />
            <Route path="/my-cvs" element={<MyCvsPage />} />
            <Route path="/cv/:cvId" element={<CvPage />} />
            <Route path="/profile" element={
              <div style={{ padding: '32px' }}><ProfilePage /></div>
            } />
            <Route path="/admin" element={
              <div style={{ padding: '32px' }}><AdminPage /></div>
            } />
            <Route path="/directory" element={<DirectoryPage />} />
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
        background: `linear-gradient(135deg, #2D0B3E 0%, ${P} 55%, ${DN_COLORS.primaryLight} 100%)`,
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
      background: `linear-gradient(135deg, #2D0B3E 0%, ${P} 55%, ${DN_COLORS.primaryLight} 100%)`,
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
      <ThemeProvider>
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
      </ThemeProvider>
    </ErrorBoundary>
  );
}
