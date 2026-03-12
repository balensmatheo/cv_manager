import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean; error: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F9FAFB', fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ textAlign: 'center', maxWidth: '420px', padding: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', color: '#111827', marginBottom: '8px' }}>
            Une erreur est survenue
          </h2>
          <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.6', marginBottom: '20px' }}>
            {this.state.error || 'Erreur inattendue'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #7B2882 0%, #9B3AA8 100%)',
              color: 'white', border: 'none', borderRadius: '10px',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
