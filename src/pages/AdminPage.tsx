import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Users, Eye, ShieldCheck, RefreshCw, BarChart3, DollarSign, Zap, TrendingUp, Settings, Save, Trash2 } from 'lucide-react';
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

interface UsageData {
  period: { days: number; since: string };
  totals: {
    invocations: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    importInvocations: number;
    agentInvocations: number;
    importTokens: number;
    agentTokens: number;
    estimatedCostUsd: number;
  };
  perUser: Array<{ email: string; invocations: number; tokens: number; importInvocations: number; agentInvocations: number }>;
  daily: Array<{ date: string; tokens: number; invocations: number }>;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = 'users' | 'usage' | 'config';

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('users');

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
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F3F4F6', borderRadius: '10px', padding: '4px' }}>
        {([
          { id: 'users' as Tab, label: 'Utilisateurs', icon: <Users size={14} /> },
          { id: 'usage' as Tab, label: 'Consommation', icon: <BarChart3 size={14} /> },
          { id: 'config' as Tab, label: 'Configuration', icon: <Settings size={14} /> },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t.id ? 'white' : 'transparent',
            color: tab === t.id ? P : '#6B7280',
            boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'usage' && <UsageTab />}
      {tab === 'config' && <ConfigTab />}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
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
      // First get CV list
      const { data: listResult, errors: listErrors } = await client.queries.getUserCv({ username });
      if (listErrors?.length) throw new Error(listErrors[0].message);
      const listParsed = JSON.parse(listResult ?? '{}') as {
        found: boolean;
        cvs?: Array<{ id: string; name: string }>;
        legacyData?: unknown;
      };
      if (!listParsed.found || !listParsed.cvs?.length) {
        if (listParsed.legacyData) {
          setViewingCv({ email, data: listParsed.legacyData });
          return;
        }
        toast.info(`${email} n'a pas encore de CV sauvegardé`);
        return;
      }
      // Load the first (most recent) CV
      const firstCv = listParsed.cvs[0];
      const { data: cvResult, errors: cvErrors } = await client.queries.getUserCv({ username, cvId: firstCv.id });
      if (cvErrors?.length) throw new Error(cvErrors[0].message);
      const cvParsed = JSON.parse(cvResult ?? '{}') as { found: boolean; data?: unknown };
      if (!cvParsed.found) {
        toast.info(`CV introuvable`);
        return;
      }
      setViewingCv({ email, data: cvParsed.data });
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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={() => { void loadUsers(); }} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '8px',
          border: `1.5px solid ${P}`, background: 'white', color: P,
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
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
                    {u.groups.includes('ADMINS') ? (
                      <span style={badgeStyle(P, '#F3E8F5')}>Admin</span>
                    ) : (
                      <span style={badgeStyle('#6B7280', '#F3F4F6')}>User</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '11px', color: u.status === 'CONFIRMED' ? '#059669' : '#D97706' }}>
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
                      <button onClick={() => { void handleViewCv(u.username, u.email); }} style={actionBtnStyle} title="Voir le CV">
                        <Eye size={14} />
                      </button>
                      {!u.groups.includes('ADMINS') && (
                        <button
                          onClick={() => { void handlePromote(u.username, 'ADMINS'); }}
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
              }}>✕</button>
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
    </>
  );
}

// ── Usage Tab ─────────────────────────────────────────────────────────────────
function UsageTab() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result, errors } = await client.queries.getAllUsage({ days });
      if (errors?.length) throw new Error(errors[0].message);
      if (result) setData(JSON.parse(result) as UsageData);
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void loadUsage(); }, [loadUsage]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '14px' }}>Chargement...</div>;
  }

  if (!data) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Aucune donnée</div>;
  }

  const { totals, perUser, daily } = data;
  const maxDayTokens = Math.max(...daily.map(d => d.tokens), 1);

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', gap: '4px' }}>
        {[7, 14, 30, 60].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: '6px 12px', borderRadius: '6px', border: 'none',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            background: days === d ? P : '#F3F4F6',
            color: days === d ? 'white' : '#666',
            transition: 'all 0.15s',
          }}>
            {d}j
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <KpiCard icon={<Zap size={18} />} label="Invocations totales" value={totals.invocations.toString()} sub={`${totals.importInvocations} imports · ${totals.agentInvocations} agent`} color="#2563EB" />
        <KpiCard icon={<TrendingUp size={18} />} label="Tokens consommés" value={formatNumber(totals.tokens)} sub={`${formatNumber(totals.inputTokens)} in · ${formatNumber(totals.outputTokens)} out`} color="#059669" />
        <KpiCard icon={<DollarSign size={18} />} label="Coût estimé" value={`$${totals.estimatedCostUsd.toFixed(4)}`} sub="Claude Haiku 4.5" color="#D97706" />
        <KpiCard icon={<BarChart3 size={18} />} label="Utilisateurs actifs" value={perUser.length.toString()} sub={`sur ${days} jours`} color={P} />
      </div>

      {/* Daily chart */}
      <div style={{
        background: 'white', borderRadius: '16px', padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111', margin: '0 0 16px' }}>
          Consommation quotidienne (tokens)
        </h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px' }}>
          {daily.map((d, i) => {
            const h = Math.max((d.tokens / maxDayTokens) * 100, 2);
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                title={`${d.date}\n${formatNumber(d.tokens)} tokens\n${d.invocations} invocations`}>
                <div style={{
                  width: '100%', maxWidth: '20px', height: `${h}%`,
                  background: `linear-gradient(180deg, ${P} 0%, ${DN_COLORS.primaryLight} 100%)`,
                  borderRadius: '3px 3px 0 0', minHeight: '2px',
                  transition: 'height 0.3s',
                }} />
              </div>
            );
          })}
        </div>
        {daily.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontSize: '10px', color: '#999' }}>{daily[0].date}</span>
            <span style={{ fontSize: '10px', color: '#999' }}>{daily[daily.length - 1].date}</span>
          </div>
        )}
      </div>

      {/* Per-user breakdown */}
      <div style={{
        background: 'white', borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111', margin: 0, padding: '16px 16px 12px' }}>
          Consommation par utilisateur
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th style={thStyle}>Utilisateur</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Imports</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Agent</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total invoc.</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Tokens</th>
            </tr>
          </thead>
          <tbody>
            {perUser.map((u, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 500, color: '#111' }}>{u.email}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <span style={badgeStyle('#2563EB', '#EFF6FF')}>{u.importInvocations}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <span style={badgeStyle(P, '#F3E8F5')}>{u.agentInvocations}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{u.invocations}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#6B7280' }}>{formatNumber(u.tokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {perUser.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF', fontSize: '13px' }}>
            Aucune consommation sur cette période
          </div>
        )}
      </div>
    </div>
  );
}


// ── Config Tab ───────────────────────────────────────────────────────────────
interface AdminConfigData {
  defaults: {
    agent: { model: string; dailyLimit: number; dailyTokenLimit: number };
    import: { model: string; dailyLimit: number; dailyTokenLimit: number };
  };
  userOverrides: Array<{
    userId: string;
    email?: string;
    agentDailyLimit?: number;
    agentDailyTokenLimit?: number;
    importDailyLimit?: number;
    importDailyTokenLimit?: number;
  }>;
}

function ConfigTab() {
  const [config, setConfig] = useState<AdminConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // New override form
  const [newUserId, setNewUserId] = useState('');
  const [newAgentLimit, setNewAgentLimit] = useState('');
  const [newAgentTokenLimit, setNewAgentTokenLimit] = useState('');
  const [newImportLimit, setNewImportLimit] = useState('');
  const [newImportTokenLimit, setNewImportTokenLimit] = useState('');

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result, errors } = await client.mutations.adminConfig({ action: 'getConfig' });
      if (errors?.length) throw new Error(errors[0].message);
      if (result) setConfig(JSON.parse(result) as AdminConfigData);
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadConfig(); }, [loadConfig]);

  const handleSaveOverride = async (userId: string, email: string | undefined, overrides: {
    agentDailyLimit?: number; agentDailyTokenLimit?: number;
    importDailyLimit?: number; importDailyTokenLimit?: number;
  }) => {
    setSaving(userId);
    try {
      const { errors } = await client.mutations.adminConfig({
        action: 'setUserLimits',
        payload: JSON.stringify({ userId, ...overrides }),
      });
      if (errors?.length) throw new Error(errors[0].message);
      toast.success(`Limites mises à jour pour ${email || userId}`);
      void loadConfig();
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteOverride = async (userId: string, email: string | undefined) => {
    if (!window.confirm(`Supprimer les limites personnalisées pour ${email || userId} ?`)) return;
    setSaving(userId);
    try {
      const { errors } = await client.mutations.adminConfig({
        action: 'deleteUserLimits',
        payload: JSON.stringify({ userId }),
      });
      if (errors?.length) throw new Error(errors[0].message);
      toast.success('Limites supprimées (retour aux valeurs par défaut)');
      void loadConfig();
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setSaving(null);
    }
  };

  const handleAddOverride = async () => {
    if (!newUserId.trim()) { toast.error('Sélectionnez un utilisateur'); return; }
    const overrides: Record<string, number> = {};
    if (newAgentLimit) overrides.agentDailyLimit = parseInt(newAgentLimit);
    if (newAgentTokenLimit) overrides.agentDailyTokenLimit = parseInt(newAgentTokenLimit);
    if (newImportLimit) overrides.importDailyLimit = parseInt(newImportLimit);
    if (newImportTokenLimit) overrides.importDailyTokenLimit = parseInt(newImportTokenLimit);
    if (Object.keys(overrides).length === 0) { toast.error('Renseignez au moins une limite'); return; }

    await handleSaveOverride(newUserId, undefined, overrides);
    setNewUserId(''); setNewAgentLimit(''); setNewAgentTokenLimit('');
    setNewImportLimit(''); setNewImportTokenLimit('');
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '14px' }}>Chargement...</div>;
  }

  if (!config) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Aucune donnée</div>;
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    border: '1.5px solid #E5E7EB', fontSize: '13px', fontFamily: 'inherit',
    outline: 'none', transition: 'border-color 0.15s',
  };

  return (
    <div>
      {/* Models info */}
      <div style={{
        background: 'white', borderRadius: '16px', padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111', margin: '0 0 16px' }}>
          <Zap size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Modèles utilisés
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{
            padding: '14px', borderRadius: '12px', border: '1px solid #E5E7EB',
            background: '#FAFAFA',
          }}>
            <div style={{ fontSize: '11px', color: '#888', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Agent CV
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#111', wordBreak: 'break-all' }}>
              {config.defaults.agent.model}
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
              Limite par défaut : {config.defaults.agent.dailyLimit} appels/jour · {formatNumber(config.defaults.agent.dailyTokenLimit)} tokens/jour
            </div>
          </div>
          <div style={{
            padding: '14px', borderRadius: '12px', border: '1px solid #E5E7EB',
            background: '#FAFAFA',
          }}>
            <div style={{ fontSize: '11px', color: '#888', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Import PDF
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#111', wordBreak: 'break-all' }}>
              {config.defaults.import.model}
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
              Limite par défaut : {config.defaults.import.dailyLimit} appels/jour · {formatNumber(config.defaults.import.dailyTokenLimit)} tokens/jour
            </div>
          </div>
        </div>
      </div>

      {/* Per-user overrides */}
      <div style={{
        background: 'white', borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px',
      }}>
        <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111', margin: 0 }}>
            <Settings size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Limites par utilisateur
          </h3>
          <button onClick={() => { void loadConfig(); }} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '6px 12px', borderRadius: '6px',
            border: `1.5px solid ${P}`, background: 'white', color: P,
            fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>

        {config.userOverrides.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={thStyle}>Utilisateur</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Agent appels/j</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Agent tokens/j</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Import appels/j</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Import tokens/j</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {config.userOverrides.map(uo => (
                <UserOverrideRow
                  key={uo.userId}
                  override={uo}
                  defaults={config.defaults}
                  saving={saving === uo.userId}
                  onSave={(overrides) => { void handleSaveOverride(uo.userId, uo.email, overrides); }}
                  onDelete={() => { void handleDeleteOverride(uo.userId, uo.email); }}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF', fontSize: '13px', borderTop: '1px solid #F3F4F6' }}>
            Aucune limite personnalisée. Tous les utilisateurs ont les limites par défaut.
          </div>
        )}
      </div>

      {/* Add new override */}
      <div style={{
        background: 'white', borderRadius: '16px', padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111', margin: '0 0 16px' }}>
          Ajouter une limite personnalisée
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>User ID (sub Cognito)</label>
            <input value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="ex: abc123-..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Agent appels/j</label>
            <input type="number" value={newAgentLimit} onChange={e => setNewAgentLimit(e.target.value)} placeholder={String(config.defaults.agent.dailyLimit)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Agent tokens/j</label>
            <input type="number" value={newAgentTokenLimit} onChange={e => setNewAgentTokenLimit(e.target.value)} placeholder={formatNumber(config.defaults.agent.dailyTokenLimit)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Import appels/j</label>
            <input type="number" value={newImportLimit} onChange={e => setNewImportLimit(e.target.value)} placeholder={String(config.defaults.import.dailyLimit)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Import tokens/j</label>
            <input type="number" value={newImportTokenLimit} onChange={e => setNewImportTokenLimit(e.target.value)} placeholder={formatNumber(config.defaults.import.dailyTokenLimit)} style={inputStyle} />
          </div>
          <button onClick={() => { void handleAddOverride(); }} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px', height: '38px',
            background: P, color: 'white', border: 'none',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}>
            <Save size={14} /> Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Override Row (inline editable) ──────────────────────────────────────
function UserOverrideRow({ override, defaults, saving, onSave, onDelete }: {
  override: AdminConfigData['userOverrides'][0];
  defaults: AdminConfigData['defaults'];
  saving: boolean;
  onSave: (overrides: Record<string, number>) => void;
  onDelete: () => void;
}) {
  const [agentLimit, setAgentLimit] = useState(String(override.agentDailyLimit ?? ''));
  const [agentTokens, setAgentTokens] = useState(String(override.agentDailyTokenLimit ?? ''));
  const [importLimit, setImportLimit] = useState(String(override.importDailyLimit ?? ''));
  const [importTokens, setImportTokens] = useState(String(override.importDailyTokenLimit ?? ''));

  const handleSave = () => {
    const o: Record<string, number> = {};
    if (agentLimit) o.agentDailyLimit = parseInt(agentLimit);
    if (agentTokens) o.agentDailyTokenLimit = parseInt(agentTokens);
    if (importLimit) o.importDailyLimit = parseInt(importLimit);
    if (importTokens) o.importDailyTokenLimit = parseInt(importTokens);
    onSave(o);
  };

  const cellInputStyle: React.CSSProperties = {
    width: '80px', padding: '4px 8px', borderRadius: '6px',
    border: '1.5px solid #E5E7EB', fontSize: '12px', fontFamily: 'inherit',
    textAlign: 'center', outline: 'none',
  };

  return (
    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
      <td style={tdStyle}>
        <span style={{ fontWeight: 500, color: '#111' }}>{override.email || override.userId}</span>
        {override.email && <div style={{ fontSize: '10px', color: '#999', fontFamily: 'monospace' }}>{override.userId.slice(0, 12)}...</div>}
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <input value={agentLimit} onChange={e => setAgentLimit(e.target.value)}
          placeholder={String(defaults.agent.dailyLimit)} style={cellInputStyle} type="number" />
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <input value={agentTokens} onChange={e => setAgentTokens(e.target.value)}
          placeholder={String(defaults.agent.dailyTokenLimit)} style={cellInputStyle} type="number" />
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <input value={importLimit} onChange={e => setImportLimit(e.target.value)}
          placeholder={String(defaults.import.dailyLimit)} style={cellInputStyle} type="number" />
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <input value={importTokens} onChange={e => setImportTokens(e.target.value)}
          placeholder={String(defaults.import.dailyTokenLimit)} style={cellInputStyle} type="number" />
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          <button onClick={handleSave} disabled={saving} title="Sauvegarder" style={{
            ...actionBtnStyle, color: '#059669', borderColor: '#D1FAE5',
          }}>
            <Save size={13} />
          </button>
          <button onClick={onDelete} disabled={saving} title="Supprimer" style={{
            ...actionBtnStyle, color: '#EF4444', borderColor: '#FEE2E2',
          }}>
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: '#6B7280', marginBottom: '4px', textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: '14px', padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #F3F4F6',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: '#111', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>{sub}</div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
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
