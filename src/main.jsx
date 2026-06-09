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

// OTA manual (por sesion): limpia cualquier flag persistente viejo
// para que la app nunca quede atrapada en la version en linea al reabrir.
try { localStorage.removeItem('ota_mode') } catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
