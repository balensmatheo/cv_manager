import { useEffect, useState, useCallback } from 'react';
import { list, downloadData } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import { toast } from 'sonner';
import { History, Eye, RotateCcw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useResume, type ResumeData } from '../context/ResumeContext';
import { DN_COLORS } from '../theme/tokens';

const P = DN_COLORS.primary;

interface VersionEntry {
  key: string;
  timestamp: string;
  label: string;
}

interface Props {
  cvId: string;
}

export default function VersionHistory({ cvId }: Props) {
  const { loadData } = useResume();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ResumeData | null>(null);
  const [previewLabel, setPreviewLabel] = useState('');

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const identityId = session.identityId!;
      const prefix = `private/${identityId}/cvs/${cvId}/versions/`;

      const result = await list({ path: prefix });
      const items = result.items
        .filter(item => item.path.endsWith('.json'))
        .map(item => {
          const filename = item.path.split('/').pop()!.replace('.json', '');
          // Convert back from version timestamp format
          const ts = filename.replace(/-/g, (m, offset: number) => {
            // Pattern: YYYY-MM-DDTHH-MM-SS-SSSZ → restore colons and dots
            if (offset === 4 || offset === 7) return '-'; // date separators
            if (offset === 13 || offset === 16) return ':'; // time separators
            if (offset === 19) return '.'; // ms separator
            return m;
          });
          return {
            key: item.path,
            timestamp: ts,
            label: formatVersionDate(ts),
          };
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      setVersions(items);
    } catch {
      toast.error('Erreur chargement des versions');
    } finally {
      setLoading(false);
    }
  }, [cvId]);

  useEffect(() => {
    if (open) void loadVersions();
  }, [open, loadVersions]);

  const handlePreview = async (version: VersionEntry) => {
    try {
      const res = await downloadData({ path: version.key }).result;
      const data = JSON.parse(await res.body.text()) as ResumeData;
      setPreviewData(data);
      setPreviewLabel(version.label);
    } catch {
      toast.error('Erreur chargement de la version');
    }
  };

  const handleRestore = () => {
    if (!previewData) return;
    if (!window.confirm('Restaurer cette version ? Vos modifications non sauvegardees seront perdues.')) return;
    loadData(previewData);
    setPreviewData(null);
    setOpen(false);
    toast.success('Version restauree. Pensez a sauvegarder.');
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: '1px solid var(--dn-divider)', borderRadius: '6px',
          padding: '4px 10px', fontSize: '12px', color: 'var(--dn-text-secondary)',
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px',
        }}
      >
        <History size={13} />
        Versions
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Side panel */}
      {open && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '340px',
          background: 'white', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 900, fontFamily: "'Inter', sans-serif",
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid #E5E7EB',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={16} color={P} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#111' }}>
                Historique des versions
              </h3>
            </div>
            <button onClick={() => { setOpen(false); setPreviewData(null); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#999',
            }}>
              <X size={16} />
            </button>
          </div>

          {/* Preview banner */}
          {previewData && (
            <div style={{
              padding: '12px 20px', background: `${P}10`,
              borderBottom: `2px solid ${P}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: P }}>Apercu</div>
                <div style={{ fontSize: '10px', color: '#666' }}>{previewLabel}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={handleRestore} style={{
                  background: P, color: 'white', border: 'none', borderRadius: '6px',
                  padding: '5px 10px', fontSize: '11px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  <RotateCcw size={11} /> Restaurer
                </button>
                <button onClick={() => setPreviewData(null)} style={{
                  background: 'white', color: '#666', border: '1px solid #ddd', borderRadius: '6px',
                  padding: '5px 10px', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* Version list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '13px' }}>
                Chargement...
              </div>
            ) : versions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '13px' }}>
                Aucune version enregistree.
                <br />
                <span style={{ fontSize: '11px' }}>Les versions sont creees a chaque sauvegarde.</span>
              </div>
            ) : (
              versions.map((v, i) => (
                <div
                  key={v.key}
                  style={{
                    padding: '10px 20px',
                    borderBottom: '1px solid #F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FAFAFA'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>
                      {v.label}
                    </div>
                    <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                      {i === 0 ? 'Version la plus recente' : `Il y a ${i} version${i > 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <button
                    onClick={() => { void handlePreview(v); }}
                    title="Apercu"
                    style={{
                      background: `${P}10`, border: `1px solid ${P}30`, borderRadius: '6px',
                      padding: '4px 8px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '10px', fontWeight: 600, color: P, fontFamily: 'inherit',
                    }}
                  >
                    <Eye size={11} /> Apercu
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

function formatVersionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}
