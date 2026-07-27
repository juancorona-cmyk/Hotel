import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
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

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

// OTA persistente: si el staff ya elegio "Actualizar en linea" en StaffApp,
// cada arranque de la app vuelve a cargar esa version en vez de la version
// vieja empacada en el APK — ya no se revierte solo. Se verifica que el
// sitio responda antes de navegar para no dejar la app varada sin red.
async function boot() {
  const wantsOnline = Capacitor.isNativePlatform() &&
    !location.hostname.includes('hotelpuntagaleria') &&
    (() => { try { return localStorage.getItem('ota_mode') === '1' } catch { return false } })()

  if (wantsOnline) {
    try {
      const r = await fetch('https://hotelpuntagaleria.mx/version.json', { cache: 'no-store' })
      if (r.ok) {
        // Si el arranque vino de un deep link (QR de check-in, appUrlOpen
        // dispara demasiado tarde para verlo aqui), preservar esa ruta al
        // saltar a la version en linea — si no, se perderia el ?rid=.
        let path = '/checkin'
        try {
          const launch = await CapApp.getLaunchUrl()
          if (launch?.url) {
            const u = new URL(launch.url)
            if (u.pathname && u.pathname !== '/') path = u.pathname + u.search
            else if (u.search) path = '/checkin' + u.search
          }
        } catch { /* sin deep link pendiente */ }
        const sep = path.includes('?') ? '&' : '?'
        window.location.href = `https://hotelpuntagaleria.mx${path}${sep}v=${Date.now()}`
        return
      }
    } catch { /* sin red: seguir con la version local empacada */ }
  }

  renderApp()
}

boot()
