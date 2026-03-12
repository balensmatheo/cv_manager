import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Users, Eye, ShieldCheck, RefreshCw } from 'lucide-react';

const client = generateClient<Schema>();
const P = '#7B2882';

interface UserInfo {
  username: string;
  email: string;
  groups: string[];
  createdAt: string;
  status: string;
}

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingCv, setViewingCv] = useState<{ email: string; data: unknown } | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result, errors } = await client.queries.listUsers({});
      if (errors?.length) throw new Error(errors[0].message);
      if (result) setUsers(JSON.parse(result) as UserInfo[]);
    } catch (err) {
      toast.error(`Erreur chargement utilisateurs : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const handleViewCv = async (username: string, email: string) => {
    try {
      const { data: result, errors } = await client.queries.getUserCv({ username });
      if (errors?.length) throw new Error(errors[0].message);
      const parsed = JSON.parse(result ?? '{}') as { found: boolean; data?: unknown };
      if (!parsed.found) {
        toast.info(`${email} n'a pas encore de CV sauvegardé`);
        return;
      }
      setViewingCv({ email, data: parsed.data });
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    }
  };

  const handlePromote = async (username: string, group: string) => {
    setPromoting(username);
    try {
      const { errors } = await client.mutations.promoteUser({ username, group });
      if (errors?.length) throw new Error(errors[0].message);
      toast.success(`Utilisateur promu ${group}`);
      void loadUsers();
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setPromoting(null);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7280' }}>
        <ShieldCheck size={48} color="#D1D5DB" />
        <p style={{ marginTop: '16px', fontSize: '15px' }}>Accès réservé aux administrateurs</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>
          <Users size={22} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
          Administration
        </h2>
        <button
          onClick={() => { void loadUsers(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px',
            border: `1.5px solid ${P}`, background: 'white', color: P,
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '14px' }}>
          Chargement des utilisateurs…
        </div>
      ) : (
        <div style={{
          background: 'white', borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Rôle</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Date création</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.username} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{u.email}</span>
                  </td>
                  <td style={tdStyle}>
                    {u.groups.includes('admin') ? (
                      <span style={badgeStyle('#7B2882', '#F3E8F5')}>Admin</span>
                    ) : (
                      <span style={badgeStyle('#6B7280', '#F3F4F6')}>User</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: '11px', color: u.status === 'CONFIRMED' ? '#059669' : '#D97706',
                    }}>
                      {u.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: '#6B7280', fontSize: '12px' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : ''}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => { void handleViewCv(u.username, u.email); }}
                        style={actionBtnStyle}
                        title="Voir le CV"
                      >
                        <Eye size={14} />
                      </button>
                      {!u.groups.includes('admin') && (
                        <button
                          onClick={() => { void handlePromote(u.username, 'admin'); }}
                          disabled={promoting === u.username}
                          style={actionBtnStyle}
                          title="Promouvoir admin"
                        >
                          <ShieldCheck size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '14px' }}>
              Aucun utilisateur
            </div>
          )}
        </div>
      )}

      {/* CV Preview Modal */}
      {viewingCv && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setViewingCv(null); }}
        >
          <div style={{
            background: 'white', borderRadius: '16px', maxWidth: '700px', width: '90%',
            maxHeight: '80vh', overflow: 'auto', padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                CV de {viewingCv.email}
              </h3>
              <button onClick={() => setViewingCv(null)} style={{
                background: '#F3F4F6', border: 'none', borderRadius: '50%',
                width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px',
              }}>
                ✕
              </button>
            </div>
            <pre style={{
              background: '#F9FAFB', borderRadius: '8px', padding: '16px',
              fontSize: '11px', overflow: 'auto', maxHeight: '60vh',
              border: '1px solid #E5E7EB',
            }}>
              {JSON.stringify(viewingCv.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: '11px',
  fontWeight: 700, color: '#6B7280', textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '30px', height: '30px', borderRadius: '8px',
  border: '1px solid #E5E7EB', background: 'white',
  cursor: 'pointer', color: '#6B7280',
};

function badgeStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
    fontSize: '11px', fontWeight: 600, color, background: bg,
  };
}
