import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 40, textAlign: 'center', fontFamily: 'Montserrat, sans-serif',
        }}>
          <h2 style={{ fontSize: 24, marginBottom: 12 }}>Algo salió mal</h2>
          <p style={{ color: '#666', marginBottom: 20 }}>Por favor recarga la página para continuar.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#5a6c1e', color: '#fff', border: 'none', borderRadius: 30,
              padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Recargar página
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
