import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { toast } from 'sonner';
import { Link2, Copy, Check, X, Clock } from 'lucide-react';
import { DN_COLORS } from '../theme/tokens';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const P = DN_COLORS.primary;

interface Props {
  cvId: string;
  onClose: () => void;
}

export default function ShareCvDialog({ cvId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { data } = await client.mutations.createShareLink({
        cvId,
        expiresInDays: days,
      } as never);
      if (!data) throw new Error('Reponse vide');
      const parsed = JSON.parse(data as string) as { token: string; expiresAt: string };
      const url = `${window.location.origin}/shared/${parsed.token}`;
      setShareUrl(url);
      setExpiresAt(parsed.expiresAt);
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Echec creation lien'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Lien copie !');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Dialog */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'white', borderRadius: '16px', padding: '28px',
            width: '460px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: `${P}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Link2 size={18} color={P} />
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111' }}>
                Partager ce CV
              </h3>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', color: '#999', borderRadius: '8px',
            }}>
              <X size={18} />
            </button>
          </div>

          {!shareUrl ? (
            <>
              {/* Expiration selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '8px' }}>
                  <Clock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Duree de validite
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 7, 14, 30].map(d => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '8px',
                        border: days === d ? `2px solid ${P}` : '1px solid #E5E7EB',
                        background: days === d ? `${P}10` : 'white',
                        color: days === d ? P : '#666',
                        fontWeight: days === d ? 700 : 500,
                        fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {d} jour{d > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <p style={{ fontSize: '12px', color: '#888', lineHeight: 1.5, marginBottom: '20px' }}>
                Un lien public sera genere. Toute personne disposant du lien pourra consulter
                votre CV en lecture seule pendant la duree choisie.
              </p>

              <button
                onClick={() => { void handleCreate(); }}
                disabled={loading}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  background: P, color: 'white', border: 'none',
                  fontWeight: 700, fontSize: '13px', cursor: loading ? 'wait' : 'pointer',
                  fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Generation...' : 'Generer le lien de partage'}
              </button>
            </>
          ) : (
            <>
              {/* Share URL display */}
              <div style={{
                background: '#F9FAFB', border: '1px solid #E5E7EB',
                borderRadius: '10px', padding: '12px', marginBottom: '12px',
              }}>
                <div style={{
                  fontSize: '11px', color: '#666', wordBreak: 'break-all',
                  lineHeight: 1.5, fontFamily: 'monospace',
                }}>
                  {shareUrl}
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#888', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} />
                Expire le {formatDate(expiresAt)}
              </div>

              <button
                onClick={() => { void handleCopy(); }}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  background: copied ? '#22c55e' : P,
                  color: 'white', border: 'none',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '8px',
                  transition: 'background 0.2s',
                }}
              >
                {copied ? <><Check size={16} /> Copie !</> : <><Copy size={16} /> Copier le lien</>}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
