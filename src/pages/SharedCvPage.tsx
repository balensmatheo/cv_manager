import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ResumeProvider, useResume, type ResumeData } from '../context/ResumeContext';
import CV from '../components/CV';
import CVClassic from '../components/CVClassic';
import MultiPageWrapper from '../components/MultiPageWrapper';
import { DN_COLORS } from '../theme/tokens';
import outputs from '../../amplify_outputs.json';

const P = DN_COLORS.primary;
const SHARED_CV_URL = (outputs as Record<string, unknown> & { custom?: { shared_cv_url?: string } }).custom?.shared_cv_url || '';

function SharedCvContent() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { data, loadData } = useResume();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) { setError('Token manquant'); setLoading(false); return; }
    if (!SHARED_CV_URL) { setError('Service de partage non configure'); setLoading(false); return; }

    void (async () => {
      try {
        const res = await fetch(`${SHARED_CV_URL}?token=${encodeURIComponent(token)}`);
        const parsed = await res.json() as { data?: ResumeData; error?: string };
        if (parsed.error) {
          setError(parsed.error);
        } else if (parsed.data) {
          loadData(parsed.data);
          setLoaded(true);
        } else {
          setError('CV introuvable');
        }
      } catch {
        setError('Impossible de charger le CV partage');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontFamily: "'Inter', sans-serif",
        fontSize: '14px', color: '#9CA3AF', background: '#f5f3f7',
      }}>
        Chargement du CV partage...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontFamily: "'Inter', sans-serif",
        background: '#f5f3f7', padding: '24px',
      }}>
        <div style={{
          background: 'white', borderRadius: '16px', padding: '40px',
          textAlign: 'center', maxWidth: '400px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>:(</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: '0 0 8px' }}>
            Lien invalide
          </h2>
          <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5, margin: 0 }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!loaded) return null;

  const theme = data.settings?.theme || 'dn';
  const accent = data.settings?.accentColor || P;

  return (
    <div style={{
      background: '#f5f3f7', minHeight: '100vh',
      paddingTop: '24px', paddingBottom: '40px',
    }}>
      {/* Shared banner */}
      <div className="no-print" style={{
        maxWidth: '210mm', margin: '0 auto 16px',
        background: 'white', borderRadius: '10px',
        padding: '10px 18px', fontSize: '12px', color: '#666',
        fontFamily: "'Inter', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <span>CV partage en lecture seule</span>
        <button
          onClick={() => window.print()}
          style={{
            background: accent, color: 'white', border: 'none',
            borderRadius: '6px', padding: '6px 14px', fontSize: '11px',
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Imprimer / PDF
        </button>
      </div>

      {/* CV display */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div id="cv-wrapper">
          <MultiPageWrapper
            accentColor={accent}
            footerText={data.personal?.website || ''}
          >
            {theme === 'classic' ? <CVClassic /> : <CV />}
          </MultiPageWrapper>
        </div>
      </div>
    </div>
  );
}

export default function SharedCvPage() {
  return (
    <ResumeProvider>
      <SharedCvContent />
    </ResumeProvider>
  );
}
