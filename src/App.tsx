import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { generateClient } from 'aws-amplify/data';
import { uploadData, downloadData } from 'aws-amplify/storage';
import {
  signOut as amplifySignOut,
  getCurrentUser,
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
  fetchUserAttributes,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { ResumeProvider, useResume, type ResumeData } from './context/ResumeContext';
import CV from './components/CV';
import AuthPage from './components/AuthPage';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Schema } from '../amplify/data/resource';
import QRCode from 'qrcode';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc as string;

const client = generateClient<Schema>();

const P = '#7B2882';
const GRAD = `linear-gradient(135deg, ${P} 0%, #9B3AA8 100%)`;

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

// ── TOTP Setup Modal ──────────────────────────────────────────────────────────
function TotpModal({ onClose }: { onClose: () => void }) {
  const [qrSrc, setQrSrc]       = useState('');
  const [secret, setSecret]     = useState('');
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);
  const [focused, setFocused]   = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const setup = await setUpTOTP();
        const attrs = await fetchUserAttributes();
        const uri = setup.getSetupUri('CV Manager', attrs.email ?? '').toString();
        const qr = await QRCode.toDataURL(uri, {
          width: 180, margin: 1,
          color: { dark: '#3D0A4E', light: '#ffffff' },
        });
        setQrSrc(qr);
        setSecret(setup.sharedSecret);
      } catch {
        setError('Impossible de générer la configuration 2FA');
      }
    })();
  }, []);

  const handleVerify = async () => {
    setLoading(true); setError('');
    try {
      await verifyTOTPSetup({ code });
      await updateMFAPreference({ totp: 'PREFERRED' });
      setDone(true);
    } catch {
      setError('Code invalide ou expiré');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'white', borderRadius: '20px', overflow: 'hidden',
        width: '380px', maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{ background: GRAD, padding: '22px 24px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '16px' }}>
              🔐 Authentification 2FA
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginTop: '3px', letterSpacing: '0.5px' }}>
              TOTP — Google Authenticator / Authy
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
            width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer',
            fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px 8px' }}>
          {done ? (
            <div style={{ textAlign: 'center' as const, padding: '16px 0 8px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#111827', marginBottom: '6px' }}>
                2FA activé avec succès
              </div>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px', lineHeight: '1.6' }}>
                Votre compte est maintenant protégé par l'authentification à deux facteurs.
                Le code sera demandé à chaque connexion.
              </p>
              <button onClick={onClose} style={{
                padding: '10px 28px', background: GRAD, color: 'white',
                border: 'none', borderRadius: '10px', fontWeight: 600,
                fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Fermer
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
                  padding: '10px 14px', fontSize: '13px', color: '#DC2626', marginBottom: '16px',
                }}>
                  {error}
                </div>
              )}
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6B7280', lineHeight: '1.6' }}>
                Scannez ce QR code avec{' '}
                <strong style={{ color: '#374151' }}>Google Authenticator</strong> ou{' '}
                <strong style={{ color: '#374151' }}>Authy</strong>, puis entrez le code généré.
              </p>
              {qrSrc ? (
                <div style={{ textAlign: 'center' as const, marginBottom: '14px' }}>
                  <img src={qrSrc} alt="QR Code 2FA" style={{ borderRadius: '12px', border: '4px solid #F3F4F6' }} />
                </div>
              ) : !error && (
                <div style={{ height: '188px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                  Génération du QR code…
                </div>
              )}
              <details style={{ marginBottom: '14px' }}>
                <summary style={{ fontSize: '12px', color: '#9CA3AF', cursor: 'pointer', userSelect: 'none' as const }}>
                  Saisie manuelle du secret
                </summary>
                <code style={{
                  display: 'block', marginTop: '8px', padding: '10px 12px',
                  background: '#F9FAFB', border: '1px solid #E5E7EB',
                  borderRadius: '8px', fontSize: '12px',
                  wordBreak: 'break-all' as const, color: '#374151',
                }}>
                  {secret || '…'}
                </code>
              </details>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                color: '#6B7280', letterSpacing: '0.6px',
                textTransform: 'uppercase' as const, marginBottom: '5px',
              }}>
                Code de vérification
              </label>
              <input
                type="text" value={code} placeholder="123456"
                onChange={e => setCode(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                  display: 'block', width: '100%', padding: '11px 14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${focused ? P : '#E5E7EB'}`,
                  boxShadow: focused ? `0 0 0 3px rgba(123,40,130,0.12)` : 'none',
                  fontSize: '14px', fontFamily: 'inherit', outline: 'none',
                  color: '#111827', background: focused ? '#fff' : '#F9FAFB',
                  boxSizing: 'border-box' as const, marginBottom: '10px',
                }}
              />
              <button
                onClick={() => { void handleVerify(); }}
                disabled={loading || !qrSrc}
                style={{
                  display: 'block', width: '100%', padding: '12px',
                  background: loading || !qrSrc ? '#C8A0D0' : GRAD,
                  color: 'white', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                  cursor: loading || !qrSrc ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(123,40,130,0.3)',
                }}
              >
                {loading ? '…' : 'Activer la 2FA →'}
              </button>
            </>
          )}
        </div>
        <div style={{ height: '20px' }} />
      </div>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
function Toolbar({
  printScale, onPrint, onSave, saveLoading, signOut, onSetupTotp,
}: {
  printScale: number; onPrint: () => void;
  onSave: () => void; saveLoading: boolean;
  signOut: () => void; onSetupTotp: () => void;
}) {
  const { editMode, setEditMode, downloadJSON, resetData, loadData } = useResume();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef  = useRef<HTMLInputElement>(null);
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
      loadData(JSON.parse(result!) as ResumeData);
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
    reader.onload = ev => {
      try { loadData(JSON.parse(ev.target?.result as string) as ResumeData); }
      catch { alert('Fichier JSON invalide'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const btn = (label: string, onClick: () => void, opts?: {
    white?: boolean; disabled?: boolean; title?: string;
  }) => (
    <button
      onClick={onClick} disabled={opts?.disabled} title={opts?.title}
      style={{
        background: opts?.white ? 'white' : 'rgba(255,255,255,0.15)',
        color: opts?.white ? P : 'white',
        border: opts?.white ? 'none' : '1px solid rgba(255,255,255,0.4)',
        padding: '7px 14px', borderRadius: '8px',
        fontWeight: 600, fontSize: '13px', cursor: opts?.disabled ? 'wait' : 'pointer',
        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px',
        boxShadow: opts?.white ? '0 2px 6px rgba(0,0,0,0.12)' : 'none',
        opacity: opts?.disabled ? 0.65 : 1,
        whiteSpace: 'nowrap' as const,
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="no-print" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: GRAD, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: '52px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src="/logo-dn.png" alt="" style={{ height: '28px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        <span style={{ fontWeight: 600, fontSize: '14px', opacity: 0.9 }}>CV Manager</span>
        {editMode && (
          <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '2px 10px', fontSize: '11px', fontWeight: 600 }}>
            ✏️ Mode Édition
          </span>
        )}
        <ScaleBadge scale={printScale} />
      </div>

      {/* Right */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button onClick={() => setEditMode(!editMode)} style={{
          background: editMode ? 'white' : 'rgba(255,255,255,0.15)',
          color: editMode ? P : 'white',
          border: editMode ? 'none' : '1px solid rgba(255,255,255,0.4)',
          padding: '7px 14px', borderRadius: '8px',
          fontWeight: 600, fontSize: '13px', cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          {editMode ? '✅ Terminer' : '✏️ Modifier'}
        </button>

        {btn('📄 PDF', onPrint, { white: true })}
        {btn(saveLoading ? '⏳…' : '💾 Sauvegarder', onSave, { disabled: saveLoading })}
        {btn('⬇ JSON', downloadJSON)}

        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        {btn('⬆ JSON', () => fileRef.current?.click())}

        <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={e => { void handlePdfImport(e); }} />
        {btn(pdfLoading ? '⏳ Analyse…' : '⬆ PDF', () => pdfRef.current?.click(), { disabled: pdfLoading })}

        {btn('🔐 2FA', onSetupTotp, { title: 'Configurer l\'authentification 2FA' })}

        <button onClick={resetData} title="Réinitialiser" style={{
          background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '7px 10px', borderRadius: '8px',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>↺</button>

        <button onClick={signOut} title="Se déconnecter" style={{
          background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '7px 12px', borderRadius: '8px',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>⬪ Déco</button>
      </div>
    </div>
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

// ── AppContent ────────────────────────────────────────────────────────────────
function AppContent({ onSignOut }: { onSignOut: () => void }) {
  const { data, loadData } = useResume();
  const [printScale, setPrintScale] = useState(1);
  const [saveLoading, setSaveLoading] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [totpOpen, setTotpOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await downloadData({
          path: ({ identityId }) => `private/${identityId}/resume.json`,
        }).result;
        if (cancelled) return;
        loadData(JSON.parse(await res.body.text()) as ResumeData);
      } catch { /* no S3 file → keep defaults */ }
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
      alert('CV sauvegardé !');
    } catch (err) {
      alert(`Erreur sauvegarde : ${err instanceof Error ? err.message : err}`);
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
        minHeight: '100vh', background: '#ddd',
        fontFamily: "'Inter', sans-serif", fontSize: '15px', color: '#666',
      }}>
        Chargement du CV…
      </div>
    );
  }

  return (
    <>
      {totpOpen && <TotpModal onClose={() => setTotpOpen(false)} />}
      <Toolbar
        printScale={printScale}
        onPrint={handlePrint}
        onSave={() => { void handleSave(); }}
        saveLoading={saveLoading}
        signOut={onSignOut}
        onSetupTotp={() => setTotpOpen(true)}
      />
      <div className="cv-outer-wrapper" style={{
        paddingTop: '68px', paddingBottom: '40px',
        minHeight: '100vh', background: '#ddd',
      }}>
        <div id="cv-wrapper"><CV /></div>
      </div>
    </>
  );
}

// ── Auth-aware layout ─────────────────────────────────────────────────────────
type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

function AuthLayout() {
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    getCurrentUser()
      .then(() => setAuthState('authenticated'))
      .catch(() => setAuthState('unauthenticated'));

    const unsub = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn')  setAuthState('authenticated');
      if (payload.event === 'signedOut') setAuthState('unauthenticated');
    });
    return unsub;
  }, []);

  const handleSignOut = useCallback(() => {
    void amplifySignOut().then(() => setAuthState('unauthenticated'));
  }, []);

  if (authState === 'loading') {
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

  if (authState === 'authenticated') {
    return (
      <ResumeProvider>
        <AppContent onSignOut={handleSignOut} />
      </ResumeProvider>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, #2D0B3E 0%, ${P} 55%, #9B3AA8 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif", padding: '24px',
      position: 'relative' as const, overflow: 'hidden',
    }}>
      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: '-8%', right: '-4%', width: '420px', height: '420px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-12%', left: '-6%', width: '520px', height: '520px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
      <AuthPage onAuthenticated={() => setAuthState('authenticated')} />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return <AuthLayout />;
}
