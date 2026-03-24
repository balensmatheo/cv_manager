import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FolderOpen, User, Shield, LogOut, ChevronsLeft, ChevronsRight, BookOpen, Sun, Moon } from 'lucide-react';
import { DN_COLORS } from '../theme/tokens';

const WIDTH_OPEN = 220;
const WIDTH_CLOSED = 60;

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user, isAdmin, signOut } = useAuth();
  const { resolved, toggle: toggleTheme } = useTheme();
  const w = collapsed ? WIDTH_CLOSED : WIDTH_OPEN;

  const linkStyle = (isActive: boolean) => ({
    display: 'flex', alignItems: 'center', gap: collapsed ? '0px' : '10px',
    justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
    padding: collapsed ? '10px' : '10px 16px', borderRadius: '10px',
    fontSize: '13px', fontWeight: 600 as const,
    textDecoration: 'none',
    color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
    background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
    transition: 'all 0.2s',
  });

  return (
    <div className="no-print" style={{
      width: `${w}px`, minHeight: '100vh',
      background: DN_COLORS.gradientVertical,
      display: 'flex', flexDirection: 'column' as const,
      padding: collapsed ? '20px 8px' : '20px 12px',
      fontFamily: "'Inter', sans-serif",
      position: 'fixed' as const, left: 0, top: 0, bottom: 0,
      zIndex: 300,
      transition: 'width 0.2s, padding 0.2s',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: collapsed ? '8px 0' : '8px 16px',
        marginBottom: '20px',
        minHeight: '40px',
      }}>
        {collapsed ? (
          <img src="/logo-dn.png" alt="" style={{ height: '22px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <img src="/logo-dn.png" alt="" style={{ height: '24px', objectFit: 'contain', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
            <span style={{ color: 'white', fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap' }}>CV Manager</span>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        title={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
        style={{
          display: 'flex', alignItems: 'center', gap: collapsed ? '0px' : '10px',
          justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
          padding: collapsed ? '8px' : '8px 16px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600,
          fontFamily: 'inherit', width: '100%',
          marginBottom: '8px',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
      >
        {collapsed ? <ChevronsRight size={14} /> : <><ChevronsLeft size={14} style={{ flexShrink: 0 }} /><span>Réduire</span></>}
      </button>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0 12px' }} />

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px', flex: 1 }}>
        <NavLink to="/my-cvs" style={({ isActive }) => linkStyle(isActive)} title="Mes CVs">
          <FolderOpen size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>Mes CVs</span>}
        </NavLink>
        <NavLink to="/profile" style={({ isActive }) => linkStyle(isActive)} title="Profil">
          <User size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>Profil</span>}
        </NavLink>
        {isAdmin && (
          <NavLink to="/directory" style={({ isActive }) => linkStyle(isActive)} title="Répertoire CVs">
            <BookOpen size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>Répertoire CVs</span>}
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin" style={({ isActive }) => linkStyle(isActive)} title="Administration">
            <Shield size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>Administration</span>}
          </NavLink>
        )}
      </nav>

      {/* Dark mode toggle */}
      <button
        onClick={toggleTheme}
        title={resolved === 'dark' ? 'Mode clair' : 'Mode sombre'}
        style={{
          display: 'flex', alignItems: 'center', gap: collapsed ? '0px' : '10px',
          justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
          padding: collapsed ? '10px' : '10px 16px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600,
          color: 'rgba(255,255,255,0.65)',
          background: 'transparent',
          border: 'none', cursor: 'pointer', width: '100%',
          fontFamily: 'inherit',
          transition: 'all 0.15s',
          marginTop: 'auto',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        {resolved === 'dark' ? <Sun size={16} style={{ flexShrink: 0 }} /> : <Moon size={16} style={{ flexShrink: 0 }} />}
        {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{resolved === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>}
      </button>

      {/* User info + sign out */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '16px', marginTop: '12px' }}>
        {!collapsed && (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', padding: '0 16px', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {user?.email}
          </div>
        )}
        <button
          onClick={signOut}
          title="Déconnexion"
          style={{
            display: 'flex', alignItems: 'center', gap: collapsed ? '0px' : '10px',
            justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
            padding: collapsed ? '10px' : '10px 16px', borderRadius: '10px',
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
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>Déconnexion</span>}
        </button>
      </div>
    </div>
  );
}

export { WIDTH_OPEN, WIDTH_CLOSED };
