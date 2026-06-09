import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import './i18n'
import './index.css'

// Bloquear clic derecho y arrastre en imágenes y videos
document.addEventListener('contextmenu', (e) => {
  if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
    e.preventDefault()
  }
})
document.addEventListener('dragstart', (e) => {
  if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
    e.preventDefault()
  }
})

// ── OTA manual: modo "version en linea" ──
// Solo dentro de la app nativa. Si el usuario activo el modo remoto,
// carga la version desplegada (ultimo git push) al abrir.
try {
  const isBundled = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  if (window.Capacitor && isBundled) {
    const params = new URLSearchParams(location.search)
    if (params.get('installed') === '1') {
      localStorage.setItem('ota_mode', 'installed')
      history.replaceState(null, '', location.pathname)
    }
    if (localStorage.getItem('ota_mode') === 'remote') {
      location.replace('https://hotelpuntagaleria.mx/checkin')
    }
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
