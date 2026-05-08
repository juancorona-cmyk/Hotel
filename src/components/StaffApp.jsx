import { useState, useEffect } from 'react'
import { getEvents, getActivityRegistrationsByEvent } from '../lib/turso'
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
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const hasPerm = (key) => role === 'admin' || !!perms?.[key]

  useEffect(() => {
    if (authed && view === 'events' && hasPerm('eventos')) {
      setLoading(true)
      getEvents()
        .then(setEvents)
        .finally(() => setLoading(false))
    }
  }, [authed, view, role, perms])

  const viewAttendees = async (ev) => {
    setSelectedEvent(ev)
    setLoading(true)
    setView('attendees')
    try {
      const regs = await getActivityRegistrationsByEvent(ev.id)
      setAttendees(regs)
    } catch (err) {
      alert('Error al cargar asistentes')
    } finally {
      setLoading(false)
    }
  }

  if (!authed) {
    return <CheckInPage />
  }

  // Handle back to menu
  const goHome = () => { setView('menu'); setSelectedEvent(null); setAttendees([]); setSearch('') }

  const filteredAttendees = attendees.filter(a => 
    a.full_name.toLowerCase().includes(search.toLowerCase()) || 
    a.phone.includes(search)
  )

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
                <div key={ev.id} className="sa-event-card" onClick={() => viewAttendees(ev)}>
                  <div className="sa-event-info">
                    <strong>{ev.name}</strong>
                    <span>{ev.date}</span>
                  </div>
                  <div className="sa-event-stats">
                    →
                  </div>
                </div>
              ))}
              {events.length === 0 && <p className="sa-empty">No hay eventos activos.</p>}
            </div>
          )}
        </div>
      )}

      {view === 'attendees' && selectedEvent && (
        <div className="sa-attendees">
          <div className="sa-top">
            <button className="sa-back" onClick={() => setView('events')}>← Volver</button>
            <div className="sa-top-text">
              <h2>{selectedEvent.name}</h2>
              <span style={{fontSize: 12, color: '#666'}}>{attendees.length} registrados</span>
            </div>
          </div>

          <div className="sa-search-wrap">
            <input 
              type="text" 
              placeholder="Buscar por nombre o celular..." 
              className="sa-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {loading ? <p className="sa-loading">Cargando lista...</p> : (
            <div className="sa-list">
              {filteredAttendees.map(a => (
                <div key={a.id} className="sa-event-card" style={{flexDirection: 'column', alignItems: 'flex-start', gap: 8}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
                    <strong>{a.full_name}</strong>
                    <span style={{fontSize: 11, color: '#94a3b8'}}>{a.phone}</span>
                  </div>
                  <div style={{display: 'flex', gap: 8}}>
                    <span className={`sa-badge ${a.paid ? 'ok' : 'pend'}`} style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                      background: a.paid ? '#f0fdf4' : '#fffbeb',
                      color: a.paid ? '#16a34a' : '#d97706'
                    }}>
                      {a.paid ? 'PAGADO' : 'PENDIENTE'}
                    </span>
                    <span className={`sa-badge ${a.checked_in ? 'ok' : 'pend'}`} style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                      background: a.checked_in ? '#f0fdf4' : '#f1f5f9',
                      color: a.checked_in ? '#16a34a' : '#64748b'
                    }}>
                      {a.checked_in ? 'CONFIRMADO' : 'FALTA'}
                    </span>
                  </div>
                </div>
              ))}
              {filteredAttendees.length === 0 && <p className="sa-empty">No se encontraron resultados.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
