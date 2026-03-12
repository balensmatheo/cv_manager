import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, User, Shield, LogOut } from 'lucide-react';

const P = '#7B2882';

export default function Sidebar() {
  const { user, isAdmin, signOut } = useAuth();

  const linkStyle = (isActive: boolean) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 16px', borderRadius: '10px',
    fontSize: '13px', fontWeight: 600 as const,
    textDecoration: 'none',
    color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
    background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
    transition: 'all 0.15s',
  });

  return (
    <div className="no-print" style={{
      width: '220px', minHeight: '100vh',
      background: `linear-gradient(180deg, #2D0B3E 0%, ${P} 100%)`,
      display: 'flex', flexDirection: 'column' as const,
      padding: '20px 12px',
      fontFamily: "'Inter', sans-serif",
      position: 'fixed' as const, left: 0, top: 0, bottom: 0,
      zIndex: 300,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', marginBottom: '28px' }}>
        <img src="/logo-dn.png" alt="" style={{ height: '24px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        <span style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>CV Manager</span>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px', flex: 1 }}>
        <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>
          <FileText size={16} /> Mon CV
        </NavLink>
        <NavLink to="/profile" style={({ isActive }) => linkStyle(isActive)}>
          <User size={16} /> Profil
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" style={({ isActive }) => linkStyle(isActive)}>
            <Shield size={16} /> Administration
          </NavLink>
        )}
      </nav>

      {/* User info + sign out */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '16px', marginTop: '12px' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', padding: '0 16px', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {user?.email}
        </div>
        <button
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 16px', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600,
            color: 'rgba(255,255,255,0.65)',
            background: 'transparent',
            border: 'none', cursor: 'pointer', width: '100%',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={16} /> Déconnexion
        </button>
      </div>
    </div>
  );
}
