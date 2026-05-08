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

  const [view, setView] = useState('dashboard')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [events, setEvents] = useState([])
  const [allRegs, setAllRegs] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    Promise.all([getEvents(), getAllActivityRegistrations()])
      .then(([evs, regs]) => { setEvents(evs); setAllRegs(regs) })
      .finally(() => setLoading(false))
  }, [authed])

  const handleLogout = () => {
    localStorage.removeItem('ci_authed')
    localStorage.removeItem('ci_role')
    localStorage.removeItem('ci_perms')
    setAuthed(false)
  }

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

  const goBack = () => {
    setView('dashboard')
    setSelectedEvent(null)
    setAttendees([])
    setSearch('')
    setFilter('all')
  }

  if (!authed) return <CheckInPage />

  const totalConfirmed = allRegs.filter(r => r.checked_in).length
  const totalPaid = allRegs.filter(r => r.paid).length

  const filteredAttendees = attendees.filter(a => {
    const matchSearch = (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.phone || '').includes(search)
    if (!matchSearch) return false
    if (filter === 'confirmed') return a.checked_in
    if (filter === 'pending') return !a.checked_in
    return true
  })

  const checkedCount = attendees.filter(a => a.checked_in).length
  const pendingCount = attendees.length - checkedCount

  // ── Dashboard ──
  if (view === 'dashboard') {
    return (
      <div className="sa-root">
        <header className="sa-header">
          <img src="/logo/logNegro.svg" alt="Staff" className="sa-logo" />
          <div className="sa-header-right">
            <span className="sa-role-badge">{role === 'admin' ? 'Admin' : 'Staff'}</span>
            <button className="sa-logout" onClick={handleLogout}>Salir</button>
          </div>
        </header>

        <div className="sa-hero">
          <p className="sa-hero-label">Bienvenido al panel</p>
          <h1 className="sa-hero-title">Hotel Punta Galería</h1>
          <div className="sa-stats-row">
            <div className="sa-stat-pill">
              <span className="sa-stat-pill-num">{events.length}</span>
              <span className="sa-stat-pill-lbl">Eventos</span>
            </div>
            <div className="sa-stat-pill sa-stat-pill--green">
              <span className="sa-stat-pill-num">{totalConfirmed}</span>
              <span className="sa-stat-pill-lbl">Confirmados</span>
            </div>
            <div className="sa-stat-pill sa-stat-pill--blue">
              <span className="sa-stat-pill-num">{totalPaid}</span>
              <span className="sa-stat-pill-lbl">Pagados</span>
            </div>
          </div>
        </div>

        <div className="sa-body">
          <div className="sa-section-header">
            <h2 className="sa-section-title">Eventos activos</h2>
            <span className="sa-section-count">{events.length}</span>
          </div>

          {loading ? (
            <div className="sa-loading-wrap">
              <div className="sa-spinner" />
              <p>Cargando…</p>
            </div>
          ) : events.length === 0 ? (
            <div className="sa-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p>No hay eventos activos</p>
            </div>
          ) : (
            <div className="sa-event-list">
              {events.map(ev => {
                const evRegs = allRegs.filter(r => String(r.event_id) === String(ev.id))
                const confirmed = evRegs.filter(r => r.checked_in).length
                const pct = evRegs.length > 0 ? Math.round((confirmed / evRegs.length) * 100) : 0
                return (
                  <div key={ev.id} className="sa-event-card" onClick={() => viewAttendees(ev)}>
                    <div className="sa-event-top">
                      <div className="sa-event-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                      </div>
                      <div className="sa-event-info">
                        <strong className="sa-event-name">{ev.name}</strong>
                        <span className="sa-event-date">{ev.date || 'Sin fecha'}</span>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                    <div className="sa-event-progress-row">
                      <span className="sa-event-progress-txt">
                        <b>{confirmed}</b> / {evRegs.length} confirmados
                      </span>
                      <span className="sa-event-pct">{pct}%</span>
                    </div>
                    <div className="sa-progress-bar">
                      <div className="sa-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* FAB Escanear QR */}
        <button className="sa-fab" onClick={() => navigate('/checkin')} aria-label="Escanear QR">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <line x1="14" y1="14" x2="14.01" y2="14" strokeWidth="3"/>
            <line x1="18" y1="14" x2="18.01" y2="14" strokeWidth="3"/>
            <line x1="21" y1="17" x2="21.01" y2="17" strokeWidth="3"/>
            <line x1="14" y1="18" x2="14.01" y2="18" strokeWidth="3"/>
            <line x1="18" y1="21" x2="21" y2="21"/>
            <line x1="21" y1="18" x2="21" y2="21"/>
          </svg>
          <span>Escanear QR</span>
        </button>
      </div>
    )
  }

  // ── Attendees view ──
  return (
    <div className="sa-root">
      <header className="sa-header sa-header--sub">
        <button className="sa-back-btn" onClick={goBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="sa-header-title">
          <span className="sa-header-event-name">{selectedEvent?.name}</span>
          <span className="sa-header-event-date">{selectedEvent?.date || ''}</span>
        </div>
        <button className="sa-logout" onClick={handleLogout}>Salir</button>
      </header>

      <div className="sa-attendees-stats">
        <div className="sa-astat sa-astat--total">
          <span className="sa-astat-num">{attendees.length}</span>
          <span className="sa-astat-lbl">Total</span>
        </div>
        <div className="sa-astat sa-astat--ok">
          <span className="sa-astat-num">{checkedCount}</span>
          <span className="sa-astat-lbl">Confirmados</span>
        </div>
        <div className="sa-astat sa-astat--pend">
          <span className="sa-astat-num">{pendingCount}</span>
          <span className="sa-astat-lbl">Pendientes</span>
        </div>
      </div>

      <div className="sa-body">
        <div className="sa-search-wrap">
          <div className="sa-search-field">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono…"
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
              >{label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="sa-loading-wrap"><div className="sa-spinner" /><p>Cargando lista…</p></div>
        ) : (
          <div className="sa-attendee-list">
            {filteredAttendees.map(a => (
              <div key={a.id} className="sa-attendee-card" onClick={() => navigate(`/checkin?rid=${a.id}`)}>
                <div className="sa-attendee-row">
                  <div className={`sa-attendee-dot ${a.checked_in ? 'sa-dot--ok' : 'sa-dot--pend'}`} />
                  <div className="sa-attendee-info">
                    <strong className="sa-attendee-name">{a.full_name}</strong>
                    <span className="sa-attendee-phone">{a.phone}</span>
                  </div>
                  <div className="sa-attendee-tags">
                    {a.paid
                      ? <span className="sa-tag sa-tag--paid">Pagado</span>
                      : <span className="sa-tag sa-tag--unpaid">Pend. pago</span>
                    }
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
                {a.checked_in && (
                  <div className="sa-attendee-confirmed">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Entrada confirmada
                  </div>
                )}
              </div>
            ))}
            {filteredAttendees.length === 0 && (
              <div className="sa-empty"><p>No se encontraron resultados</p></div>
            )}
          </div>
        )}
      </div>

      <button className="sa-fab" onClick={() => navigate('/checkin')} aria-label="Escanear QR">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <line x1="14" y1="14" x2="14.01" y2="14" strokeWidth="3"/>
          <line x1="18" y1="14" x2="18.01" y2="14" strokeWidth="3"/>
          <line x1="21" y1="17" x2="21.01" y2="17" strokeWidth="3"/>
          <line x1="14" y1="18" x2="14.01" y2="18" strokeWidth="3"/>
          <line x1="18" y1="21" x2="21" y2="21"/>
          <line x1="21" y1="18" x2="21" y2="21"/>
        </svg>
        <span>Escanear QR</span>
      </button>
    </div>
  )
}
