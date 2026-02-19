import { useState, useCallback } from 'react';
import {
  signIn,
  signUp,
  confirmSignUp,
  confirmSignIn,
  setUpTOTP,
  verifyTOTPSetup,
  resendSignUpCode,
} from 'aws-amplify/auth';
import QRCode from 'qrcode';

const P = '#7B2882';
const GRAD = `linear-gradient(135deg, ${P} 0%, #9B3AA8 100%)`;

type View = 'signIn' | 'signUp' | 'confirmEmail' | 'mfaVerify' | 'mfaSetup';

function tErr(msg: string): string {
  if (/incorrect.*username.*password|user.*not.*found/i.test(msg))
    return 'Email ou mot de passe incorrect';
  if (/user.*already.*exists/i.test(msg))
    return 'Un compte existe déjà avec cet email';
  if (/password.*did.*not.*conform/i.test(msg))
    return 'Mot de passe trop simple (min. 8 car., 1 majuscule, 1 chiffre, 1 symbole)';
  if (/invalid.*verification.*code|code.*mismatch/i.test(msg))
    return 'Code invalide ou expiré';
  if (/attempt.*limit/i.test(msg))
    return 'Trop de tentatives, réessayez dans quelques minutes';
  if (/not.*authorized/i.test(msg)) return 'Action non autorisée';
  return msg;
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({
  label, type = 'text', value, onChange, placeholder, autoFocus, hint,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  autoFocus?: boolean; hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block', fontSize: '11px', fontWeight: 700,
        color: '#6B7280', letterSpacing: '0.6px',
        textTransform: 'uppercase' as const, marginBottom: '5px',
      }}>
        {label}
      </label>
      <input
        type={type} value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: 'block', width: '100%', padding: '11px 14px',
          borderRadius: '10px',
          border: `1.5px solid ${focused ? P : '#E5E7EB'}`,
          boxShadow: focused ? `0 0 0 3px rgba(123,40,130,0.12)` : 'none',
          fontSize: '14px', fontFamily: "'Inter', sans-serif",
          outline: 'none', color: '#111827',
          background: focused ? '#fff' : '#F9FAFB',
          boxSizing: 'border-box' as const,
          transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
        }}
      />
      {hint && (
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9CA3AF' }}>{hint}</p>
      )}
    </div>
  );
}

// ── Primary button ────────────────────────────────────────────────────────────
function PrimaryBtn({ label, onClick, loading }: {
  label: string; onClick: () => void; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={loading}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
      style={{
        display: 'block', width: '100%', padding: '12px',
        background: loading ? '#C8A0D0' : GRAD,
        color: 'white', border: 'none', borderRadius: '10px',
        fontSize: '14px', fontWeight: 700, fontFamily: "'Inter', sans-serif",
        cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px',
        boxShadow: loading ? 'none' : '0 4px 14px rgba(123,40,130,0.35)',
        letterSpacing: '0.2px', transition: 'opacity 0.15s',
      }}
    >
      {loading ? '…' : label}
    </button>
  );
}

// ── Error box ─────────────────────────────────────────────────────────────────
function ErrBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{
      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
      padding: '10px 14px', fontSize: '13px', color: '#DC2626',
      marginBottom: '16px', lineHeight: '1.5',
    }}>
      {msg}
    </div>
  );
}

// ── Link button ───────────────────────────────────────────────────────────────
function LinkBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', padding: '0',
      color: P, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
      fontFamily: "'Inter', sans-serif",
      textDecoration: 'underline',
      textDecorationColor: 'rgba(123,40,130,0.35)',
    }}>
      {children}
    </button>
  );
}

// ── AuthPage ──────────────────────────────────────────────────────────────────
export default function AuthPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [view, setView]           = useState<View>('signIn');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [code, setCode]           = useState('');
  const [qrSrc, setQrSrc]         = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError('');
    try { await fn(); }
    catch (e) { setError(tErr(e instanceof Error ? e.message : String(e))); }
    finally { setLoading(false); }
  }, []);

  const handleStep = useCallback(async (step: string) => {
    if (step === 'DONE') { onAuthenticated(); return; }
    if (step === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
      setCode(''); setView('mfaVerify'); return;
    }
    if (step === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
      const setup = await setUpTOTP();
      const uri = setup.getSetupUri('CV Manager', email).toString();
      const qr = await QRCode.toDataURL(uri, {
        width: 180, margin: 1,
        color: { dark: '#3D0A4E', light: '#ffffff' },
      });
      setQrSrc(qr); setTotpSecret(setup.sharedSecret);
      setCode(''); setView('mfaSetup'); return;
    }
    setError(`Étape non gérée : ${step}`);
  }, [email, onAuthenticated]);

  const onSignIn = () => run(async () => {
    const { nextStep } = await signIn({ username: email, password });
    await handleStep(nextStep.signInStep);
  });

  const onSignUp = () => run(async () => {
    if (password !== confirm) throw new Error('Les mots de passe ne correspondent pas');
    const { nextStep } = await signUp({
      username: email, password,
      options: { userAttributes: { email } },
    });
    if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') { setCode(''); setView('confirmEmail'); }
    else onAuthenticated();
  });

  const onConfirmEmail = () => run(async () => {
    await confirmSignUp({ username: email, confirmationCode: code });
    const { nextStep } = await signIn({ username: email, password });
    await handleStep(nextStep.signInStep);
  });

  const onResend = () => run(async () => {
    await resendSignUpCode({ username: email });
    alert('Code renvoyé !');
  });

  const onMfaVerify = () => run(async () => {
    const { nextStep } = await confirmSignIn({ challengeResponse: code });
    await handleStep(nextStep.signInStep);
  });

  const onMfaSetup = () => run(async () => {
    await verifyTOTPSetup({ code });
    const { nextStep } = await confirmSignIn({ challengeResponse: code });
    await handleStep(nextStep.signInStep);
  });

  const switchTo = (v: View) => { setView(v); setError(''); setCode(''); };

  const subtitle: Record<View, string> = {
    signIn: 'Accès sécurisé', signUp: 'Accès sécurisé',
    confirmEmail: 'Vérification email',
    mfaVerify: 'Code 2FA requis',
    mfaSetup: 'Activation 2FA',
  };

  return (
    <div style={{
      width: '400px', maxWidth: 'calc(100vw - 32px)',
      borderRadius: '20px', overflow: 'hidden',
      boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      background: 'white',
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* ── Purple header ── */}
      <div style={{
        background: GRAD, padding: '28px 28px 22px', textAlign: 'center' as const,
      }}>
        <img
          src="/logo-dn.png" alt="Decision Network"
          style={{
            height: '36px', filter: 'brightness(0) invert(1)',
            display: 'block', margin: '0 auto 12px',
            objectFit: 'contain' as const,
          }}
        />
        <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.2px' }}>
          CV Manager
        </div>
        <div style={{
          color: 'rgba(255,255,255,0.55)', fontSize: '11px',
          marginTop: '5px', letterSpacing: '0.9px', textTransform: 'uppercase' as const,
        }}>
          {subtitle[view]}
        </div>
      </div>

      {/* ── Form body ── */}
      <div style={{ padding: '24px 28px 8px' }}>

        {/* Tab switcher */}
        {(view === 'signIn' || view === 'signUp') && (
          <div style={{
            display: 'flex', marginBottom: '22px',
            borderRadius: '10px', background: '#F3F4F6', padding: '3px', gap: '2px',
          }}>
            {(['signIn', 'signUp'] as const).map(v => (
              <button key={v} onClick={() => switchTo(v)} style={{
                flex: 1, padding: '8px 0', borderRadius: '8px',
                border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                background: view === v ? 'white' : 'transparent',
                color: view === v ? P : '#9CA3AF',
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
                {v === 'signIn' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>
        )}

        <ErrBox msg={error} />

        {/* Sign in */}
        {view === 'signIn' && (
          <>
            <Field label="Email" type="email" value={email} onChange={setEmail}
              placeholder="votre@email.com" autoFocus />
            <Field label="Mot de passe" type="password" value={password} onChange={setPassword}
              placeholder="••••••••" />
            <PrimaryBtn label="Se connecter →" onClick={onSignIn} loading={loading} />
          </>
        )}

        {/* Sign up */}
        {view === 'signUp' && (
          <>
            <Field label="Email" type="email" value={email} onChange={setEmail}
              placeholder="votre@email.com" autoFocus />
            <Field label="Mot de passe" type="password" value={password} onChange={setPassword}
              placeholder="••••••••"
              hint="Min. 8 car. · 1 majuscule · 1 chiffre · 1 symbole" />
            <Field label="Confirmer le mot de passe" type="password" value={confirm}
              onChange={setConfirm} placeholder="••••••••" />
            <PrimaryBtn label="Créer le compte →" onClick={onSignUp} loading={loading} />
          </>
        )}

        {/* Confirm email */}
        {view === 'confirmEmail' && (
          <>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#6B7280', lineHeight: '1.6' }}>
              Un code à 6 chiffres a été envoyé à{' '}
              <strong style={{ color: '#374151' }}>{email}</strong>.{' '}
              Vérifiez votre boîte mail (et les spams).
            </p>
            <Field label="Code de vérification" type="text" value={code} onChange={setCode}
              placeholder="123456" autoFocus />
            <PrimaryBtn label="Vérifier →" onClick={onConfirmEmail} loading={loading} />
            <div style={{ textAlign: 'center' as const, marginTop: '12px' }}>
              <LinkBtn onClick={onResend}>Renvoyer le code</LinkBtn>
            </div>
          </>
        )}

        {/* MFA verify */}
        {view === 'mfaVerify' && (
          <>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#6B7280', lineHeight: '1.6' }}>
              Ouvrez <strong style={{ color: '#374151' }}>Google Authenticator</strong>,{' '}
              <strong style={{ color: '#374151' }}>Authy</strong> ou votre app 2FA et entrez
              le code à 6 chiffres.
            </p>
            <Field label="Code d'authentification" type="text" value={code} onChange={setCode}
              placeholder="123456" autoFocus />
            <PrimaryBtn label="Vérifier →" onClick={onMfaVerify} loading={loading} />
          </>
        )}

        {/* MFA setup (first time, REQUIRED mode) */}
        {view === 'mfaSetup' && (
          <>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6B7280', lineHeight: '1.6' }}>
              Scannez ce QR code avec{' '}
              <strong style={{ color: '#374151' }}>Google Authenticator</strong> ou{' '}
              <strong style={{ color: '#374151' }}>Authy</strong>.
            </p>
            {qrSrc && (
              <div style={{ textAlign: 'center' as const, marginBottom: '14px' }}>
                <img src={qrSrc} alt="QR Code 2FA" style={{
                  borderRadius: '12px', border: '4px solid #F3F4F6',
                }} />
              </div>
            )}
            <details style={{ marginBottom: '14px' }}>
              <summary style={{
                fontSize: '12px', color: '#9CA3AF',
                cursor: 'pointer', userSelect: 'none' as const,
              }}>
                Saisie manuelle du secret
              </summary>
              <code style={{
                display: 'block', marginTop: '8px', padding: '10px 12px',
                background: '#F9FAFB', border: '1px solid #E5E7EB',
                borderRadius: '8px', fontSize: '12px',
                wordBreak: 'break-all' as const, color: '#374151', letterSpacing: '0.5px',
              }}>
                {totpSecret}
              </code>
            </details>
            <Field label="Code de vérification (6 chiffres)" type="text" value={code}
              onChange={setCode} placeholder="123456" autoFocus />
            <PrimaryBtn label="Activer la 2FA →" onClick={onMfaSetup} loading={loading} />
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        textAlign: 'center' as const, padding: '16px 28px 20px',
        fontSize: '11px', color: '#D1D5DB',
      }}>
        © 2026 Decision Network · Réservé aux collaborateurs
      </div>
    </div>
  );
}
