import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  BookOpen, Search, RefreshCw, ChevronRight, Eye, Download, Mail,
  X, FileText, Printer, User, Clock, Shield, ArrowLeft,
} from 'lucide-react';
import { ResumeProvider } from '../context/ResumeContext';
import type { ResumeData } from '../context/ResumeContext';
import CV from '../components/CV';
import CVClassic from '../components/CVClassic';
import { DN_COLORS } from '../theme/tokens';

const client = generateClient<Schema>();
const P = DN_COLORS.primary;

interface UserInfo {
  username: string;
  email: string;
  groups: string[];
  createdAt: string;
  status: string;
}

interface CvListItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}


function userInitials(email: string) {
  const parts = email.split('@')[0].split(/[._-]/);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function DirectoryPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [cvList, setCvList] = useState<CvListItem[]>([]);
  const [cvListLoading, setCvListLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ data: ResumeData; name: string } | null>(null);
  const [emailModal, setEmailModal] = useState<{ username: string; cvId: string; cvName: string } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result, errors } = await client.queries.listUsers({});
      if (errors?.length) throw new Error(errors[0].message);
      if (result) setUsers(JSON.parse(result) as UserInfo[]);
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const loadUserCvs = async (user: UserInfo) => {
    setSelectedUser(user);
    setCvListLoading(true);
    setCvList([]);
    try {
      const { data: result, errors } = await client.queries.getUserCv({ username: user.username });
      if (errors?.length) throw new Error(errors[0].message);
      const parsed = JSON.parse(result ?? '{}') as { found: boolean; cvs?: CvListItem[] };
      setCvList(parsed.cvs || []);
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setCvListLoading(false);
    }
  };

  const handlePreview = async (username: string, cvId: string, cvName: string) => {
    try {
      const { data: result, errors } = await client.queries.getUserCv({ username, cvId });
      if (errors?.length) throw new Error(errors[0].message);
      const parsed = JSON.parse(result ?? '{}') as { found: boolean; data?: ResumeData };
      if (!parsed.found || !parsed.data) { toast.error('CV introuvable'); return; }
      setPreviewData({ data: parsed.data, name: cvName });
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9CA3AF' }}>
        <Shield size={48} color="#D1D5DB" />
        <p style={{ marginTop: '16px', fontSize: '15px' }}>Accès réservé aux administrateurs</p>
      </div>
    );
  }

  // ── CV Preview Modal ──
  if (previewData) {
    return (
      <CvPreviewModal
        data={previewData.data}
        name={previewData.name}
        onClose={() => setPreviewData(null)}
      />
    );
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );


  // ── User CV detail view ──
  if (selectedUser) {
    return (
      <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '13px', color: '#9CA3AF', marginBottom: '24px',
        }}>
          <button onClick={() => setSelectedUser(null)} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: P, fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            padding: 0,
          }}>
            <ArrowLeft size={14} /> Répertoire
          </button>
          <ChevronRight size={12} />
          <span style={{ color: '#374151', fontWeight: 600 }}>{selectedUser.email}</span>
        </div>

        {/* User header card */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '24px',
          border: '1px solid #E5E7EB', marginBottom: '24px',
          display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: `linear-gradient(135deg, ${P}18, ${P}08)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, border: `2px solid ${P}20`,
          }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: P }}>
              {userInitials(selectedUser.email)}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111' }}>
              {selectedUser.email}
            </h2>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: '#9CA3AF' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FileText size={12} /> {cvListLoading ? '...' : `${cvList.length} CV${cvList.length !== 1 ? 's' : ''}`}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Inscrit le {formatDate(selectedUser.createdAt)}
              </span>
              {selectedUser.groups.includes('ADMINS') && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  background: `${P}12`, color: P, padding: '1px 8px',
                  borderRadius: '6px', fontWeight: 600, fontSize: '11px',
                }}>
                  <Shield size={10} /> Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CVs */}
        {cvListLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF', fontSize: '14px' }}>
            <div style={{
              width: '32px', height: '32px', border: `3px solid ${P}20`,
              borderTopColor: P, borderRadius: '50%', margin: '0 auto 12px',
              animation: 'spin 0.8s linear infinite',
            }} />
            Chargement des CVs...
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : cvList.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'white', borderRadius: '16px',
            border: '2px dashed #E5E7EB',
          }}>
            <FileText size={48} color="#D1D5DB" style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '15px', color: '#6B7280', fontWeight: 600, margin: 0 }}>
              Cet utilisateur n'a pas encore de CV
            </p>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '6px 0 0' }}>
              Il doit se connecter et créer un CV pour qu'il apparaisse ici
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cvList.map(cv => (
              <div key={cv.id} style={{
                background: 'white', borderRadius: '14px',
                border: '1px solid #E5E7EB', overflow: 'hidden',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px ${P}14'; e.currentTarget.style.borderColor = `${P}30`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
              >
                {/* CV info */}
                <div style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: `${P}08`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FileText size={18} color={P} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{
                      margin: 0, fontSize: '14px', fontWeight: 700, color: '#111',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {cv.name || 'Sans titre'}
                    </h4>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#9CA3AF', marginTop: '3px' }}>
                      <span>Créé {formatDate(cv.createdAt)}</span>
                      <span>Modifié {formatDate(cv.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '4px', padding: '12px 16px', flexShrink: 0 }}>
                  <ActionButton
                    icon={<Eye size={14} />}
                    label="Aperçu"
                    onClick={() => { void handlePreview(selectedUser.username, cv.id, cv.name); }}
                  />
                  <ActionButton
                    icon={<Download size={14} />}
                    label="PDF"
                    onClick={() => { void handlePreview(selectedUser.username, cv.id, cv.name); }}
                  />
                  <ActionButton
                    icon={<Mail size={14} />}
                    label="Envoyer"
                    accent
                    onClick={() => setEmailModal({ username: selectedUser.username, cvId: cv.id, cvName: cv.name })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {emailModal && (
          <EmailModal
            username={emailModal.username}
            cvId={emailModal.cvId}
            cvName={emailModal.cvName}
            onClose={() => setEmailModal(null)}
          />
        )}
      </div>
    );
  }

  // ── User list view ──
  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: `linear-gradient(135deg, ${P}, ${DN_COLORS.primaryLight})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={20} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111', margin: 0 }}>
                Répertoire CVs
              </h1>
              <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '2px 0 0' }}>
                {users.length} collaborateur{users.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={() => { void loadUsers(); }} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '10px',
            border: '1.5px solid #E5E7EB', background: 'white', color: '#555',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${P}60`; e.currentTarget.style.color = P; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#555'; }}
          >
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>

        {/* Search bar */}
        <div style={{
          position: 'relative', marginTop: '20px',
        }}>
          <Search size={16} style={{
            position: 'absolute', left: '14px', top: '50%',
            transform: 'translateY(-50%)', color: '#9CA3AF',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un collaborateur..."
            style={{
              width: '100%', padding: '11px 14px 11px 40px',
              borderRadius: '12px', border: '1.5px solid #E5E7EB',
              fontSize: '14px', fontFamily: 'inherit', outline: 'none',
              background: 'white', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = `${P}60`; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
          />
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF', fontSize: '14px' }}>
          <div style={{
            width: '32px', height: '32px', border: `3px solid ${P}20`,
            borderTopColor: P, borderRadius: '50%', margin: '0 auto 12px',
            animation: 'spin 0.8s linear infinite',
          }} />
          Chargement...
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'white', borderRadius: '16px', border: '2px dashed #E5E7EB',
        }}>
          <User size={48} color="#D1D5DB" style={{ marginBottom: '12px' }} />
          <p style={{ fontSize: '15px', color: '#6B7280', fontWeight: 600, margin: 0 }}>
            {search ? 'Aucun résultat' : 'Aucun utilisateur'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(u => (
            <div
              key={u.username}
              onClick={() => { void loadUserCvs(u); }}
              style={{
                background: 'white', borderRadius: '14px',
                border: '1px solid #E5E7EB', padding: '16px 20px',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 4px 20px ${P}14';
                e.currentTarget.style.borderColor = `${P}30`;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: `linear-gradient(135deg, ${P}18, ${P}08)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, border: `1.5px solid ${P}15`,
              }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: P }}>
                  {userInitials(u.email)}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px', fontWeight: 600, color: '#111',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {u.email}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '3px', fontSize: '11px', color: '#9CA3AF' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={10} /> {formatDate(u.createdAt)}
                  </span>
                  <span style={{
                    display: 'inline-block', padding: '0 6px',
                    borderRadius: '4px', fontWeight: 600,
                    background: u.status === 'CONFIRMED' ? '#ECFDF5' : '#FEF3F2',
                    color: u.status === 'CONFIRMED' ? '#059669' : '#DC2626',
                    fontSize: '10px', lineHeight: '18px',
                  }}>
                    {u.status === 'CONFIRMED' ? 'Actif' : u.status}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {u.groups.includes('ADMINS') && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    background: `${P}10`, color: P, padding: '3px 10px',
                    borderRadius: '8px', fontWeight: 700, fontSize: '11px',
                  }}>
                    <Shield size={11} /> Admin
                  </span>
                )}
                <ChevronRight size={16} color="#D1D5DB" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Action Button ────────────────────────────────────────────────────────────
function ActionButton({ icon, label, onClick, accent }: {
  icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '7px 14px', borderRadius: '9px',
        border: accent ? `1.5px solid ${P}40` : '1.5px solid #E5E7EB',
        background: accent ? `${P}06` : 'white',
        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit',
        color: accent ? P : '#555',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (accent) {
          e.currentTarget.style.background = `${P}14`;
          e.currentTarget.style.borderColor = P;
        } else {
          e.currentTarget.style.borderColor = '#BFBFBF';
          e.currentTarget.style.background = '#FAFAFA';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = accent ? `${P}06` : 'white';
        e.currentTarget.style.borderColor = accent ? `${P}40` : '#E5E7EB';
      }}
    >
      {icon} {label}
    </button>
  );
}

// ── CV Preview Modal ─────────────────────────────────────────────────────────
function CvPreviewModal({ data, name, onClose }: {
  data: ResumeData; name: string; onClose: () => void;
}) {
  const handlePrint = () => {
    const cvEl = document.getElementById('dir-cv-preview');
    if (!cvEl) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Popup bloqué par le navigateur'); return; }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML).join('\n');

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>${name} - CV</title>
      ${styles}
      <style>
        body { margin: 0; padding: 0; background: white; }
        .cv-page { margin: 0 auto; }
        .no-print, .edit-btn-remove, .edit-btn { display: none !important; }
        @media print { @page { size: A4; margin: 0; } body { margin: 0; } }
      </style>
    </head><body>${cvEl.innerHTML}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column', overflow: 'auto',
    }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 1001,
        background: 'white', borderBottom: '1px solid #E5E7EB',
        padding: '12px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'none', border: '1px solid #E5E7EB', borderRadius: '8px',
            padding: '6px 12px', fontSize: '13px', color: '#555',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}>
            <X size={14} /> Fermer
          </button>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111' }}>
            Aperçu : {name}
          </h3>
        </div>
        <button onClick={handlePrint} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: P, color: 'white', border: 'none', borderRadius: '8px',
          padding: '8px 18px', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <Printer size={14} /> Imprimer / PDF
        </button>
      </div>

      <div style={{
        flex: 1, display: 'flex', justifyContent: 'center',
        padding: '24px', background: '#E5E7EB',
      }}>
        <div id="dir-cv-preview">
          <ResumeProvider initialData={data}>
            {(data.settings?.theme || 'dn') === 'classic' ? <CVClassic /> : <CV />}
          </ResumeProvider>
        </div>
      </div>
    </div>
  );
}

// ── Email Modal ──────────────────────────────────────────────────────────────
function EmailModal({ username, cvId, cvName, onClose }: {
  username: string; cvId: string; cvName: string; onClose: () => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!recipientEmail.includes('@')) { toast.error('Email invalide'); return; }
    if (!senderName.trim()) { toast.error('Nom de l\'expéditeur requis'); return; }
    setSending(true);
    try {
      const { errors } = await client.mutations.sendCvEmail({
        username, cvId, cvName,
        recipientEmail: recipientEmail.trim(),
        senderName: senderName.trim(),
        message: message.trim() || undefined,
      });
      if (errors?.length) throw new Error(errors[0].message);
      toast.success(`CV envoyé à ${recipientEmail}`);
      onClose();
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '1.5px solid #E5E7EB', fontSize: '14px', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: '#374151', marginBottom: '6px',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: '20px', maxWidth: '480px', width: '90%',
        padding: '28px', boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111' }}>
            Envoyer par email
          </h3>
          <button onClick={onClose} style={{
            background: '#F3F4F6', border: 'none', borderRadius: '50%',
            width: '30px', height: '30px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6B7280', fontSize: '15px', transition: 'background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6'; }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{
          marginBottom: '16px', padding: '12px 16px',
          background: `${P}06`, borderRadius: '12px',
          border: `1px solid ${P}15`, display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <FileText size={18} color={P} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{cvName}</div>
            <div style={{ fontSize: '11px', color: '#9CA3AF' }}>sera envoyé au format HTML</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Email du destinataire *</label>
            <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
              placeholder="client@example.com" style={inputStyle} type="email"
              onFocus={e => { e.currentTarget.style.borderColor = `${P}60`; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
            />
          </div>
          <div>
            <label style={labelStyle}>Votre nom (expéditeur) *</label>
            <input value={senderName} onChange={e => setSenderName(e.target.value)}
              placeholder="Jean Dupont" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = `${P}60`; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
            />
          </div>
          <div>
            <label style={labelStyle}>Message (optionnel)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Bonjour, veuillez trouver ci-joint le CV..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={e => { e.currentTarget.style.borderColor = `${P}60`; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '22px' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: '10px', border: '1.5px solid #E5E7EB',
            background: 'white', color: '#555', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
            Annuler
          </button>
          <button onClick={() => { void handleSend(); }} disabled={sending} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 24px', borderRadius: '10px', border: 'none',
            background: P, color: 'white', fontSize: '13px', fontWeight: 600,
            cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit',
            opacity: sending ? 0.7 : 1, transition: 'opacity 0.15s',
          }}>
            <Mail size={14} /> {sending ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
