import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadData, downloadData, remove } from 'aws-amplify/storage';
import { toast } from 'sonner';
import { Plus, Copy, Trash2, Pencil, FileText, Check, X } from 'lucide-react';
import { DN_COLORS } from '../theme/tokens';


const P = DN_COLORS.primary;

export interface CvMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function newId() {
  return `cv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function loadIndex(identityId: string): Promise<CvMeta[]> {
  try {
    const res = await downloadData({ path: `private/${identityId}/cv-index.json` }).result;
    return JSON.parse(await res.body.text()) as CvMeta[];
  } catch {
    return [];
  }
}

async function saveIndex(identityId: string, index: CvMeta[]) {
  await uploadData({
    path: `private/${identityId}/cv-index.json`,
    data: JSON.stringify(index, null, 2),
    options: { contentType: 'application/json' },
  }).result;
}

async function loadCv(identityId: string, cvId: string) {
  const res = await downloadData({ path: `private/${identityId}/cvs/${cvId}.json` }).result;
  return JSON.parse(await res.body.text());
}

async function saveCv(identityId: string, cvId: string, data: unknown) {
  await uploadData({
    path: `private/${identityId}/cvs/${cvId}.json`,
    data: JSON.stringify(data, null, 2),
    options: { contentType: 'application/json' },
  }).result;
}

async function deleteCv(identityId: string, cvId: string) {
  await remove({ path: `private/${identityId}/cvs/${cvId}.json` });
}

// ── Migrate legacy resume.json → multi-CV ────────────────────────────────────
async function migrateIfNeeded(identityId: string): Promise<CvMeta[] | null> {
  try {
    // Check if index already exists
    const existing = await loadIndex(identityId);
    if (existing.length > 0) return null;

    // Check for legacy resume.json
    const res = await downloadData({ path: `private/${identityId}/resume.json` }).result;
    const data = JSON.parse(await res.body.text());

    // Migrate it
    const id = newId();
    const now = new Date().toISOString();
    const meta: CvMeta = { id, name: 'Mon CV', createdAt: now, updatedAt: now };
    await saveCv(identityId, id, data);
    await saveIndex(identityId, [meta]);

    // Clean up legacy file
    await remove({ path: `private/${identityId}/resume.json` });

    return [meta];
  } catch {
    return null;
  }
}

// ── Resolve identityId ───────────────────────────────────────────────────────
async function getIdentityId(): Promise<string> {
  const { fetchAuthSession } = await import('aws-amplify/auth');
  const session = await fetchAuthSession();
  return session.identityId!;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function MyCvsPage() {
  const navigate = useNavigate();
  const [cvs, setCvs] = useState<CvMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [identityId, setIdentityId] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const iid = await getIdentityId();
      setIdentityId(iid);

      // Try migration first
      const migrated = await migrateIfNeeded(iid);
      const index = migrated ?? await loadIndex(iid);
      setCvs(index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (err) {
      toast.error(`Erreur chargement : ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleCreate = async () => {
    try {
      const { default: defaultData } = await import('../data/resume.json');
      const id = newId();
      const now = new Date().toISOString();
      await saveCv(identityId, id, defaultData);
      const updated = [...cvs, { id, name: 'Nouveau CV', createdAt: now, updatedAt: now }];
      await saveIndex(identityId, updated);
      setCvs(updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      toast.success('CV créé');
    } catch (err) {
      toast.error(`Erreur création : ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleDuplicate = async (meta: CvMeta) => {
    try {
      const data = await loadCv(identityId, meta.id);
      const id = newId();
      const now = new Date().toISOString();
      await saveCv(identityId, id, data);
      const updated = [...cvs, { id, name: `${meta.name} (copie)`, createdAt: now, updatedAt: now }];
      await saveIndex(identityId, updated);
      setCvs(updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      toast.success('CV dupliqué');
    } catch (err) {
      toast.error(`Erreur duplication : ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleDelete = async (meta: CvMeta) => {
    if (!window.confirm(`Supprimer "${meta.name}" ?`)) return;
    try {
      await deleteCv(identityId, meta.id);
      const updated = cvs.filter(c => c.id !== meta.id);
      await saveIndex(identityId, updated);
      setCvs(updated);
      toast.success('CV supprimé');
    } catch (err) {
      toast.error(`Erreur suppression : ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleRename = async (meta: CvMeta) => {
    const newName = renameValue.trim();
    if (!newName || newName === meta.name) { setRenamingId(null); return; }
    try {
      const updated = cvs.map(c => c.id === meta.id ? { ...c, name: newName } : c);
      await saveIndex(identityId, updated);
      setCvs(updated);
      setRenamingId(null);
      toast.success('CV renommé');
    } catch (err) {
      toast.error(`Erreur renommage : ${err instanceof Error ? err.message : err}`);
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#9CA3AF', fontSize: '14px' }}>
        Chargement de vos CVs...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111', margin: 0 }}>Mes CVs</h1>
          <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0' }}>
            {cvs.length} CV{cvs.length !== 1 ? 's' : ''} enregistré{cvs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => { void handleCreate(); }} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: P, color: 'white', border: 'none', borderRadius: '10px',
          padding: '10px 20px', fontSize: '13px', fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          <Plus size={16} /> Nouveau CV
        </button>
      </div>

      {/* Empty state */}
      {cvs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'white', borderRadius: '16px', border: '2px dashed #E5E7EB',
        }}>
          <FileText size={48} color="#D1D5DB" style={{ marginBottom: '16px' }} />
          <p style={{ fontSize: '15px', color: '#666', margin: '0 0 16px', fontWeight: 600 }}>
            Aucun CV pour le moment
          </p>
          <button onClick={() => { void handleCreate(); }} style={{
            background: P, color: 'white', border: 'none', borderRadius: '10px',
            padding: '10px 20px', fontSize: '13px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Plus size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Créer mon premier CV
          </button>
        </div>
      )}

      {/* CV cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {cvs.map(cv => (
          <div key={cv.id} style={{
            background: 'white', borderRadius: '14px',
            border: '1px solid #E5E7EB', transition: 'box-shadow 0.15s, border-color 0.15s',
            cursor: 'pointer', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px ${P}1F'; e.currentTarget.style.borderColor = `${P}40`; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
            onClick={() => navigate(`/cv/${cv.id}`)}
          >
            {/* Card body */}
            <div style={{ padding: '20px 20px 14px', flex: 1 }}>
              {/* Top row: icon + actions */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: `${P}10`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <FileText size={20} color={P} />
                </div>
                {/* Icon-only action buttons */}
                <div style={{ display: 'flex', gap: '2px' }} onClick={e => e.stopPropagation()}>
                  {([
                    { icon: <Pencil size={13} />, title: 'Renommer', onClick: () => { setRenamingId(cv.id); setRenameValue(cv.name); }, color: '#666' },
                    { icon: <Copy size={13} />, title: 'Dupliquer', onClick: () => { void handleDuplicate(cv); }, color: '#666' },
                    { icon: <Trash2 size={13} />, title: 'Supprimer', onClick: () => { void handleDelete(cv); }, color: '#ef4444' },
                  ] as const).map((a, i) => (
                    <button key={i} onClick={a.onClick} title={a.title} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '30px', height: '30px', borderRadius: '8px',
                      border: 'none', background: 'transparent',
                      color: a.color, cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = a.color === '#ef4444' ? '#FEF2F2' : '#F3F4F6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {a.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              {renamingId === cv.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }} onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleRename(cv); if (e.key === 'Escape') setRenamingId(null); }}
                    style={{
                      flex: 1, fontSize: '14px', fontWeight: 700, color: '#111',
                      border: `2px solid ${P}`, borderRadius: '8px', padding: '5px 10px',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                  <button onClick={() => { void handleRename(cv); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#22c55e' }}>
                    <Check size={18} />
                  </button>
                  <button onClick={() => setRenamingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#999' }}>
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111', margin: '0 0 8px', lineHeight: 1.3 }}>
                  {cv.name}
                </h3>
              )}

              {/* Dates */}
              <div style={{ fontSize: '11px', color: '#999', lineHeight: 1.7 }}>
                <div>Créé le {formatDate(cv.createdAt)}</div>
                <div>Modifié le {formatDate(cv.updatedAt)}</div>
              </div>
            </div>

            {/* Footer: open button */}
            <div style={{
              borderTop: '1px solid #F3F4F6', padding: '10px 20px',
              display: 'flex', justifyContent: 'flex-end',
            }}>
              <span style={{
                fontSize: '12px', fontWeight: 600, color: P,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                Ouvrir →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
