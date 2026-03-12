import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
  fetchMFAPreference,
  fetchUserAttributes,
} from 'aws-amplify/auth';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Shield, Mail, Calendar, Users } from 'lucide-react';

const P = '#7B2882';
const GRAD = `linear-gradient(135deg, ${P} 0%, #9B3AA8 100%)`;

export default function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [qrSrc, setQrSrc] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchMFAPreference().then(pref => {
      setMfaEnabled(pref.preferred === 'TOTP' || pref.enabled?.includes('TOTP') === true);
    }).catch(() => setMfaEnabled(false));
  }, []);

  const startSetup = async () => {
    try {
      const setup = await setUpTOTP();
      const attrs = await fetchUserAttributes();
      const uri = setup.getSetupUri('CV Manager', attrs.email ?? '').toString();
      const qr = await QRCode.toDataURL(uri, {
        width: 200, margin: 1,
        color: { dark: '#3D0A4E', light: '#ffffff' },
      });
      setQrSrc(qr);
      setSecret(setup.sharedSecret);
      setSetupMode(true);
    } catch {
      toast.error('Impossible de générer la configuration 2FA');
    }
  };

  const verifySetup = async () => {
    setLoading(true);
    try {
      await verifyTOTPSetup({ code });
      await updateMFAPreference({ totp: 'PREFERRED' });
      setMfaEnabled(true);
      setSetupMode(false);
      toast.success('2FA activé avec succès');
    } catch {
      toast.error('Code invalide ou expiré');
    } finally {
      setLoading(false);
    }
  };

  const card = (title: string, children: React.ReactNode) => (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px',
    }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {title}
      </h3>
      {children}
    </div>
  );

  const infoRow = (icon: React.ReactNode, label: string, value: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ color: P }}>{icon}</span>
      <span style={{ fontSize: '13px', color: '#6B7280', width: '120px' }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#111827', fontWeight: 500 }}>{value}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: '640px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>
        Mon profil
      </h2>

      {card('Informations', <>
        {infoRow(<Mail size={16} />, 'Email', user?.email ?? '')}
        {infoRow(<Users size={16} />, 'Rôle', isAdmin ? 'Administrateur' : 'Utilisateur')}
        {infoRow(<Calendar size={16} />, 'Groupes', user?.groups.join(', ') || 'Aucun')}
      </>)}

      {card('Sécurité — Authentification 2FA', <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Shield size={20} color={P} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
              {mfaEnabled === null ? 'Chargement…' : mfaEnabled ? '2FA activé' : '2FA désactivé'}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              {mfaEnabled ? 'Votre compte est protégé par TOTP' : 'Activez la double authentification pour sécuriser votre compte'}
            </div>
          </div>
        </div>

        {!setupMode && !mfaEnabled && (
          <button onClick={() => { void startSetup(); }} style={{
            padding: '10px 20px', background: GRAD, color: 'white',
            border: 'none', borderRadius: '10px', fontWeight: 600,
            fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Configurer la 2FA
          </button>
        )}

        {setupMode && (
          <div style={{ marginTop: '8px' }}>
            <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.6', margin: '0 0 14px' }}>
              Scannez ce QR code avec <strong style={{ color: '#374151' }}>Google Authenticator</strong> ou <strong style={{ color: '#374151' }}>Authy</strong>.
            </p>
            {qrSrc && (
              <div style={{ textAlign: 'center' as const, marginBottom: '14px' }}>
                <img src={qrSrc} alt="QR Code 2FA" style={{ borderRadius: '12px', border: '4px solid #F3F4F6' }} />
              </div>
            )}
            <details style={{ marginBottom: '14px' }}>
              <summary style={{ fontSize: '12px', color: '#9CA3AF', cursor: 'pointer' }}>
                Saisie manuelle du secret
              </summary>
              <code style={{
                display: 'block', marginTop: '8px', padding: '10px 12px',
                background: '#F9FAFB', border: '1px solid #E5E7EB',
                borderRadius: '8px', fontSize: '12px', wordBreak: 'break-all' as const, color: '#374151',
              }}>
                {secret}
              </code>
            </details>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text" value={code} placeholder="123456"
                onChange={e => setCode(e.target.value)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '10px',
                  border: '1.5px solid #E5E7EB', fontSize: '14px', fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box' as const,
                }}
              />
              <button
                onClick={() => { void verifySetup(); }} disabled={loading}
                style={{
                  padding: '10px 20px', background: loading ? '#C8A0D0' : GRAD,
                  color: 'white', border: 'none', borderRadius: '10px',
                  fontWeight: 600, fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {loading ? '…' : 'Activer'}
              </button>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}
