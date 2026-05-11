import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getEvents, getActivityRegistrationsByEvent, getAllActivityRegistrations } from '../lib/turso'
import './StaffApp.css'

const FILTERS = { all: 'Todos', confirmed: 'Confirmados', pending: 'Pendientes' }

export default function StaffApp({ onStartScan, onLogout }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role] = useState(() => localStorage.getItem('ci_role') || 'staff')

  const [view, setView] = useState('dashboard')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [events, setEvents] = useState([])
  const [allRegs, setAllRegs] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getEvents(), getAllActivityRegistrations()])
      .then(([evs, regs]) => { 
        setEvents(evs)
        setAllRegs(regs)
        
        // Handle returning to a specific event if eid is in URL
        const eid = searchParams.get('eid')
        if (eid && evs.length > 0) {
          const ev = evs.find(e => String(e.id) === String(eid))
          if (ev) viewAttendees(ev)
        }
      })
      .catch(err => console.error('Error loading data:', err))
      .finally(() => setLoading(false))

    // Hide splash after 2 seconds
    const timer = setTimeout(() => setShowSplash(false), 2000)
    return () => clearTimeout(timer)
  }, [])

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
    // Clear eid from URL when going back to dashboard
    navigate('/checkin', { replace: true })
  }

  const handleScanQR = () => {
    if (onStartScan) {
      onStartScan()
    } else {
      navigate('/checkin')
    }
  }

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
        {showSplash && (
          <div className="sa-splash">
            <img src="/logo/logNegro.svg" alt="Loading..." className="sa-splash-logo" />
          </div>
        )}

        <section className="sa-header-hero-section">
          <div className="sa-top-bar">
            <div className="sa-logo-text">Hotel Punta Galería</div>
            <div className="sa-top-btns">
              <button className="sa-top-btn">{role === 'admin' ? 'ADMIN' : 'STAFF'}</button>
              <button className="sa-top-btn" onClick={onLogout}>Salir</button>
            </div>
          </div>

          <div className="sa-hero-content">
            <p className="sa-hero-label">BIENVENIDO AL PANEL</p>
            <h1 className="sa-hero-title">Gestión de Accesos</h1>
          </div>

          <div className="sa-stats-grid">
            <div className="sa-stat-card">
              <span className="sa-stat-num">{loading ? '…' : events.length}</span>
              <span className="sa-stat-label">Eventos</span>
            </div>
            <div className="sa-stat-card sa-stat-card--active">
              <span className="sa-stat-num">{loading ? '…' : totalConfirmed}</span>
              <span className="sa-stat-label">Confirmados</span>
            </div>
            <div className="sa-stat-card">
              <span className="sa-stat-num">{loading ? '…' : totalPaid}</span>
              <span className="sa-stat-label">Pagados</span>
            </div>
          </div>
        </section>

        <div className="sa-body">
          <div className="sa-section-header">
            <h2 className="sa-section-title">Eventos activos</h2>
            <span className="sa-badge-count">{events.length}</span>
          </div>

          {loading ? (
            <div className="sa-skeleton-list">
              {[1, 2, 3].map(i => <div key={i} className="sa-skeleton sa-skeleton-card" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="sa-empty">
              <p>No hay eventos activos</p>
            </div>
          ) : (
            <div className="sa-event-list">
              {events.map((ev, idx) => {
                const evRegs = allRegs.filter(r => String(r.event_id) === String(ev.id))
                const confirmed = evRegs.filter(r => r.checked_in).length
                const pct = evRegs.length > 0 ? Math.round((confirmed / evRegs.length) * 100) : 0
                return (
                  <div key={ev.id} className="sa-event-card" style={{ animationDelay: `${idx * 0.05}s` }} onClick={() => viewAttendees(ev)}>
                    <div className="sa-event-main">
                      <div className="sa-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="4" width="18" height="18" rx="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                      </div>
                      <div className="sa-ev-info">
                        <span className="sa-ev-name">{ev.name}</span>
                        <span className="sa-ev-date">{ev.date || 'Sin fecha'}</span>
                      </div>
                      <div className="sa-arrow-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    </div>
                    
                    <div className="sa-progress-section">
                      <div className="sa-progress-info">
                        <span className="sa-progress-label"><b>{confirmed}</b> / {evRegs.length} confirmados</span>
                        <span className="sa-progress-pct">{pct}%</span>
                      </div>
                      <div className="sa-bar-bg">
                        <div className="sa-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <button className="sa-fab" onClick={handleScanQR}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <path d="M14 14h3v3h-3zM18 17h3v3h-3zM14 18h3v3h-3zM18 14h3v3h-3z"/>
          </svg>
          <span>Escanear QR</span>
        </button>
      </div>
    )
  }

  // ── Attendees View ──
  return (
    <div className="sa-root">
      <div className="sa-sticky-top">
        <header className="sa-attendees-header">
          <button className="sa-back-btn" onClick={goBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="sa-header-titles">
            <span className="sa-h-title">{selectedEvent?.name}</span>
            <span className="sa-h-subtitle">{selectedEvent?.date || 'Sin fecha'}</span>
          </div>
          <button className="sa-top-btn" onClick={onLogout}>Salir</button>
        </header>

        <div className="sa-attendees-stats-row">
          <div className="sa-stat-card">
            <span className="sa-stat-num">{loading ? '…' : attendees.length}</span>
            <span className="sa-stat-label">Total</span>
          </div>
          <div className="sa-stat-card sa-stat-card--active">
            <span className="sa-stat-num">{loading ? '…' : checkedCount}</span>
            <span className="sa-stat-label">Confirmados</span>
          </div>
          <div className="sa-stat-card">
            <span className="sa-stat-num">{loading ? '…' : pendingCount}</span>
            <span className="sa-stat-label">Pendientes</span>
          </div>
        </div>

        <div className="sa-search-container">
          <div className="sa-search-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#95a5a6" strokeWidth="3">
              <circle cx="11" cy="11" r="8"/><line x1="21" cy1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="sa-filter-scroll">
          {Object.entries(FILTERS).map(([key, label]) => (
            <button
              key={key}
              className={`sa-filter-chip ${filter === key ? 'sa-filter-chip--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="sa-body-list">
        {loading ? (
          <div className="sa-attendee-list">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="sa-skeleton sa-skeleton-att" />)}
          </div>
        ) : (
          <div className={`sa-attendee-list ${search ? 'sa-searching' : ''}`}>
            {filteredAttendees.map((a, idx) => (
              <div key={a.id} className="sa-attendee-card" style={{ animationDelay: `${idx * 0.03}s` }} onClick={() => navigate(`/checkin?rid=${a.id}&eid=${selectedEvent?.id}`)}>
                <div className={`sa-status-dot ${a.checked_in ? 'sa-dot--confirmed' : 'sa-dot--pending'}`} />
                <div className="sa-att-info">
                  <span className="sa-att-name">{a.full_name}</span>
                  <span className="sa-att-phone">{a.phone}</span>
                </div>
                <div className="sa-att-tags">
                  <span className={`sa-tag ${a.paid ? 'sa-tag--paid' : 'sa-tag--pending'}`}>
                    {a.paid ? 'Pagado' : 'Pendiente'}
                  </span>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#bdc3c7" strokeWidth="3">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            ))}
            {filteredAttendees.length === 0 && (
              <div className="sa-empty" style={{ padding: '40px', textAlign: 'center' }}>
                <p>No se encontraron resultados</p>
              </div>
            )}
          </div>
        )}
      </div>

      <button className="sa-fab" onClick={handleScanQR}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <path d="M14 14h3v3h-3zM18 17h3v3h-3zM14 18h3v3h-3zM18 14h3v3h-3z"/>
        </svg>
        <span>Escanear QR</span>
      </button>
    </div>
  )
}
