import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEvents, getActivityRegistrationsByEvent, getAllActivityRegistrations } from '../lib/turso'
import CheckInPage from './CheckInPage'
import './StaffApp.css'

const FILTERS = { all: 'Todos', confirmed: 'Confirmados', pending: 'Pendientes' }

export default function StaffApp() {
  const navigate = useNavigate()
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
  const [allRegistrations, setAllRegistrations] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const hasPerm = (key) => role === 'admin' || !!perms?.[key]

  useEffect(() => {
    if (authed && view === 'events' && hasPerm('eventos')) {
      setLoading(true)
      getEvents()
        .then(setEvents)
        .finally(() => setLoading(false))
    }
    if (authed && view === 'all_registrations' && hasPerm('eventos')) {
      setLoading(true)
      getAllActivityRegistrations()
        .then(setAllRegistrations)
        .finally(() => setLoading(false))
    }
  }, [authed, view])

  const viewAttendees = async (ev) => {
    setSelectedEvent(ev)
    setLoading(true)
    setView('attendees')
    setFilter('all')
    setSearch('')
    try {
      const regs = await getActivityRegistrationsByEvent(ev.id)
      setAttendees(regs)
    } catch {
      alert('Error al cargar asistentes')
    } finally {
      setLoading(false)
    }
  }

  if (!authed) {
    return <CheckInPage />
  }

  const goHome = () => {
    setView('menu')
    setSelectedEvent(null)
    setAttendees([])
    setAllRegistrations([])
    setSearch('')
    setFilter('all')
  }

  const checkedCount = attendees.filter(a => a.checked_in).length
  const pendingCount = attendees.length - checkedCount

  const filteredAttendees = attendees.filter(a => {
    const matchSearch = a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.phone.includes(search)
    if (!matchSearch) return false
    if (filter === 'confirmed') return a.checked_in
    if (filter === 'pending') return !a.checked_in
    return true
  })

  const filteredAll = allRegistrations.filter(a => {
    const matchSearch = (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.phone || '').includes(search) ||
      (a.event_name || '').toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filter === 'confirmed') return a.checked_in
    if (filter === 'pending') return !a.checked_in
    return true
  })

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
          <h1 className="sa-title">Bienvenido</h1>
          <p className="sa-subtitle">Panel {role === 'admin' ? 'Administrador' : 'Staff'} · Hotel Punta Galería</p>
          <div className="sa-grid">
            {hasPerm('eventos') && (
              <button className="sa-btn" onClick={() => setView('events')}>
                <div className="sa-btn__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <span>Ver Eventos</span>
              </button>
            )}

            {hasPerm('eventos') && (
              <button className="sa-btn sa-btn--blue" onClick={() => setView('all_registrations')}>
                <div className="sa-btn__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <span>Todos los Registros</span>
              </button>
            )}

            {hasPerm('checkin') && (
              <button className="sa-btn sa-btn--amber" onClick={() => navigate('/checkin')}>
                <div className="sa-btn__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3"/>
                    <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3"/>
                    <line x1="9" y1="15" x2="9.01" y2="15" strokeWidth="3"/>
                    <line x1="15" y1="15" x2="15.01" y2="15" strokeWidth="3"/>
                  </svg>
                </div>
                <span>Escanear QR</span>
              </button>
            )}

            {!hasPerm('eventos') && !hasPerm('checkin') && (
              <p className="sa-no-perms">No tienes permisos asignados. Contacta al administrador.</p>
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
          {loading ? (
            <div className="sa-loading-wrap">
              <div className="sa-spinner" />
              <p>Cargando eventos...</p>
            </div>
          ) : (
            <div className="sa-list">
              {events.map(ev => (
                <div key={ev.id} className="sa-event-card" onClick={() => viewAttendees(ev)}>
                  <div className="sa-event-info">
                    <strong>{ev.name}</strong>
                    <span>{ev.date}</span>
                  </div>
                  <div className="sa-event-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <div className="sa-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <p>No hay eventos activos.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'all_registrations' && (
        <div className="sa-attendees">
          <div className="sa-top">
            <button className="sa-back" onClick={goHome}>← Volver</button>
            <div className="sa-top-text">
              <h2>Todos los Registros</h2>
            </div>
          </div>

          <div className="sa-search-wrap">
            <div className="sa-search-field">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre, celular o evento..."
                className="sa-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="sa-loading-wrap">
              <div className="sa-spinner" />
              <p>Cargando registros...</p>
            </div>
          ) : (
            <div className="sa-list">
              {filteredAll.map(a => (
                <div key={a.id} className="sa-attendee-card" onClick={() => navigate(`/checkin?rid=${a.id}`)}>
                  <div className="sa-attendee-top">
                    <strong>{a.full_name}</strong>
                    <span className="sa-attendee-phone">{a.phone}</span>
                  </div>
                  <div className="sa-attendee-event">
                    <small>{a.event_name || 'Sin evento'}</small>
                  </div>
                  <div className="sa-attendee-meta">
                    <span className={`sa-tag ${a.paid ? 'sa-tag--paid' : 'sa-tag--unpaid'}`}>
                      {a.paid ? 'PAGADO' : 'PENDIENTE PAGO'}
                    </span>
                    <span className={`sa-tag ${a.checked_in ? 'sa-tag--ok' : 'sa-tag--pending'}`}>
                      {a.checked_in ? 'CONFIRMADO' : 'FALTA ENTRADA'}
                    </span>
                  </div>
                </div>
              ))}
              {filteredAll.length === 0 && (
                <div className="sa-empty">
                  <p>No se encontraron registros.</p>
                </div>
              )}
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
            </div>
          </div>

          {/* Stats bar */}
          <div className="sa-stats-bar">
            <div className="sa-stat">
              <span className="sa-stat-num">{attendees.length}</span>
              <span className="sa-stat-label">Total</span>
            </div>
            <div className="sa-stat sa-stat--ok">
              <span className="sa-stat-num">{checkedCount}</span>
              <span className="sa-stat-label">Confirmados</span>
            </div>
            <div className="sa-stat sa-stat--pend">
              <span className="sa-stat-num">{pendingCount}</span>
              <span className="sa-stat-label">Pendientes</span>
            </div>
          </div>

          {/* Search + filter */}
          <div className="sa-search-wrap">
            <div className="sa-search-field">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre o celular..."
                className="sa-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="sa-filter-tabs">
              {Object.entries(FILTERS).map(([key, label]) => (
                <button
                  key={key}
                  className={`sa-filter-tab ${filter === key ? 'sa-filter-tab--active' : ''}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="sa-loading-wrap">
              <div className="sa-spinner" />
              <p>Cargando lista...</p>
            </div>
          ) : (
            <div className="sa-list">
              {filteredAttendees.map(a => (
                <div key={a.id} className="sa-attendee-card" onClick={() => navigate(`/checkin?rid=${a.id}`)}>
                  <div className="sa-attendee-top">
                    <strong>{a.full_name}</strong>
                    <span className="sa-attendee-phone">{a.phone}</span>
                  </div>
                  <div className="sa-attendee-meta">
                    <span className={`sa-tag ${a.paid ? 'sa-tag--paid' : 'sa-tag--unpaid'}`}>
                      {a.paid ? 'PAGADO' : 'PENDIENTE PAGO'}
                    </span>
                    <span className={`sa-tag ${a.checked_in ? 'sa-tag--ok' : 'sa-tag--pending'}`}>
                      {a.checked_in ? 'CONFIRMADO' : 'FALTA ENTRADA'}
                    </span>
                    {a.payment_method && (
                      <span className="sa-tag sa-tag--method">
                        {a.payment_method === 'transferencia' ? 'Transferencia' :
                         a.payment_method === 'presencial' ? 'Pago presencial' : a.payment_method}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {filteredAttendees.length === 0 && (
                <div className="sa-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <p>No se encontraron resultados.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

