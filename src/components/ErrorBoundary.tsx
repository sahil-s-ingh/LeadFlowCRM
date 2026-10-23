import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('App crashed:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          padding: '24px',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '480px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              background: 'rgba(239,68,68,0.15)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
              fontSize: '1.8rem',
            }}>
              &#9888;
            </div>
            <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, marginBottom: '10px' }}>
              Something went wrong
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', marginBottom: '8px', lineHeight: 1.6 }}>
              The page hit an unexpected error and couldn't load. This is usually temporary.
            </p>
            {this.state.error && (
              <p style={{
                color: 'rgba(255,255,255,0.4)', fontSize: '0.76rem', marginBottom: '20px',
                fontFamily: 'monospace', wordBreak: 'break-word',
                background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px',
              }}>
                {this.state.error.message}
              </p>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '12px 28px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px',
                background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.88rem',
                fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
