import { useState, useEffect } from 'react'
import { getEvents, getAllActivityRegistrations, updateActivityRegistrationPayment } from '../lib/turso'
import CheckInPage from './CheckInPage'
import './StaffApp.css'

export default function StaffApp() {
  const [authed, setAuthed] = useState(() => localStorage.getItem('ci_authed') === 'true')
  const [role] = useState(() => localStorage.getItem('ci_role') || 'staff')
  const [perms] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ci_perms') || '{}') }
    catch { return {} }
  })

  const [view, setView] = useState('menu') 
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)

  const hasPerm = (key) => role === 'admin' || !!perms?.[key]

  useEffect(() => {
    if (authed && view === 'events' && hasPerm('eventos')) {
      setLoading(true)
      getEvents()
        .then(setEvents)
        .finally(() => setLoading(false))
    }
  }, [authed, view, role, perms])

  if (!authed) {
    return <CheckInPage />
  }

  // Handle back to menu
  const goHome = () => setView('menu')

  const handleLogout = () => {
    localStorage.removeItem('ci_authed')
    localStorage.removeItem('ci_role')
    localStorage.removeItem('ci_perms')
    setAuthed(false)
  }

  return (
    <div className="sa-container">
      <header className="sa-header">
        <img src="/logo/logNegro.svg" alt="Staff" className="sa-logo" />
        <button className="sa-logout" onClick={handleLogout}>Salir</button>
      </header>

      {view === 'menu' && (
        <div className="sa-menu">
          <h1 className="sa-title">Panel {role === 'admin' ? 'Administrador' : 'Staff'}</h1>
          <div className="sa-grid">
            {hasPerm('eventos') && (
              <button className="sa-btn" onClick={() => setView('events')}>
                <div className="sa-btn__icon">📅</div>
                <span>Ver Eventos</span>
              </button>
            )}
            
            {hasPerm('checkin') && (
              <button className="sa-btn" onClick={() => window.location.href = '/checkin'}>
                <div className="sa-btn__icon">🔍</div>
                <span>Escanear QR</span>
              </button>
            )}

            {!hasPerm('eventos') && !hasPerm('checkin') && (
              <p style={{ textAlign: 'center', color: '#666' }}>No tienes permisos asignados. Contacta al administrador.</p>
            )}
          </div>
        </div>
      )}

      {view === 'events' && (
        <div className="sa-events">
          <div className="sa-top">
            <button className="sa-back" onClick={goHome}>← Volver</button>
            <h2>Eventos Activos</h2>
          </div>
          {loading ? <p className="sa-loading">Cargando...</p> : (
            <div className="sa-list">
              {events.map(ev => (
                <div key={ev.id} className="sa-event-card">
                  <div className="sa-event-info">
                    <strong>{ev.name}</strong>
                    <span>{ev.date}</span>
                  </div>
                  <div className="sa-event-stats">
                    Capacidad: {ev.capacity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
