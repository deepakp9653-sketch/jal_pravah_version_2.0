import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    if (typeof window !== 'undefined') {
      window._lastError = String(error?.stack || error?.message || error);
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Jal Pravah ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '#/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          color: '#e2e8f0',
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FCA5A5', marginBottom: '0.75rem' }}>
              Map Display Error
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              An issue occurred while rendering the visualization (possibly due to WebGL or network asset loading). The rest of the application remains operational.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.4rem', fontSize: '0.88rem' }}
              >
                🔄 Retry View
              </button>
              <button
                onClick={this.handleReset}
                className="btn btn-outline"
                style={{ padding: '0.6rem 1.4rem', fontSize: '0.88rem' }}
              >
                🗺️ Go to 2D Flood Map
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
