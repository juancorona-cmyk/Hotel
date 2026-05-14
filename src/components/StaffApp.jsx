import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getEvents, getActivityRegistrationsByEvent, getAllActivityRegistrations, saveActivity, upsertActivityEvent, updateActivity, deleteEvent, deleteActivity, API_BASE } from '../lib/turso'
import { DatePicker, TimePicker } from './common/DateTimePickers'
import './StaffApp.css'

const FILTERS = { all: 'Todos', confirmed: 'Confirmados', pending: 'Pendientes' }
const DESC_MAX = 200

export default function StaffApp({ onStartScan, onLogout }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role] = useState(() => localStorage.getItem('ci_role') || 'staff')

  const [view, setView] = useState('dashboard')
  const [copiedId, setCopiedId] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [events, setEvents] = useState([])
  const [allRegs, setAllRegs] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showSplash, setShowSplash] = useState(true)
  const [showEventPicker, setShowEventPicker] = useState(false)

  // ── Create Event State ──
  const [newEvt, setNewEvt] = useState({ name: '', date: '', time: '', price: '', capacity: '', description: '' })
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [createdSlug, setCreatedSlug] = useState(null)

  const handleAiGenerate = async () => {
    if (!newEvt.name?.trim()) { alert('Ingresa primero el nombre del evento'); return }
    setAiLoading(true)
    try {
      const path = '/.netlify/functions/ai-description'
      const url = API_BASE ? `${API_BASE}${path}` : path
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEvt.name,
          price: parseFloat(newEvt.price) || 0,
          date: newEvt.date,
          maxLen: DESC_MAX
        }),
      })
      const data = await res.json()
      if (data.description) {
        setNewEvt(prev => ({ ...prev, description: data.description }))
      }
    } catch (err) {
      console.error(err)
      alert('Error al generar la descripción')
    } finally {
      setAiLoading(false)
    }
  }

  const lowerRole = role?.toLowerCase()
  const canCreate = lowerRole === 'admin' || lowerRole === 'staff' || lowerRole === 'editor' || (localStorage.getItem('ci_perms') && JSON.parse(localStorage.getItem('ci_perms')).eventos)

  const getEventUrl = (ev) => `https://hotelpuntagaleria.mx/evento/${ev.slug}`

  const handleCopyLink = async (ev, e) => {
    e.stopPropagation()
    if (!ev.slug) return
    try { await navigator.clipboard.writeText(getEventUrl(ev)) } catch { /* fallback ok */ }
    setCopiedId(ev.id)
    setTimeout(() => setCopiedId(id => id === ev.id ? null : id), 2200)
  }

  const handleShareWhatsApp = (ev, e) => {
    e.stopPropagation()
    if (!ev.slug) return
    const url = getEventUrl(ev)
    const msg = `¡Te invitamos a *${ev.name}* en Hotel Punta Galería! 🌿\n\nRegístrate aquí: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
  }

  const handleNativeShare = async (ev, e) => {
    e.stopPropagation()
    if (!ev.slug) return
    const url = getEventUrl(ev)
    if (navigator.share) {
      try { await navigator.share({ title: ev.name, url }) } catch { /* cancelado */ }
    } else {
      handleShareWhatsApp(ev, e)
    }
  }

  const handleCreateView = () => {
    setCreatedSlug(null)
    setEditingId(null)
    setNewEvt({ name: '', date: '', time: '', price: '', capacity: '', description: '' })
    setView('create')
  }

  const handleEditEvent = (ev) => {
    setEditingId(ev.activity_id || ev.id)
    setNewEvt({
      name: ev.name || '',
      date: ev.date || '',
      time: ev.hora || '',
      price: ev.price || '',
      capacity: ev.capacity || '',
      description: ev.description || ''
    })
    setCreatedSlug(null)
    setView('create')
  }

  const handleDeleteEvent = async (ev) => {
    if (!window.confirm(`¿Estás seguro de eliminar el evento "${ev.name}"?`)) return
    setLoading(true)
    try {
      await deleteEvent(ev.id)
      if (ev.activity_id) await deleteActivity(ev.activity_id)
      const evs = await getEvents()
      setEvents(evs)
      alert('Evento eliminado')
    } catch (err) {
      console.error(err)
      alert('Error al eliminar el evento')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    if (!newEvt.name.trim()) { alert('El nombre es obligatorio'); return }
    setCreating(true)
    try {
      let activityId = editingId
      if (editingId) {
        await updateActivity(editingId, newEvt.name.trim(), newEvt.date, newEvt.time)
      } else {
        activityId = await saveActivity(newEvt.name.trim(), newEvt.date, newEvt.time)
      }

      let slug = null
      if (activityId) {
        slug = await upsertActivityEvent(
          activityId,
          newEvt.name.trim(),
          parseFloat(newEvt.price) || 0,
          newEvt.description.trim(),
          newEvt.date,
          parseInt(newEvt.capacity) || 0
        )
      }
      setCreatedSlug(slug)
      if (!editingId) {
        setNewEvt({ name: '', date: '', time: '', price: '', capacity: '', description: '' })
      }
      // Refresh events
      const evs = await getEvents()
      setEvents(evs)
      const regs = await getAllActivityRegistrations()
      setAllRegs(regs)
      
      if (!slug || editingId) {
        setView('dashboard')
        setEditingId(null)
        if (editingId) alert('Evento actualizado exitosamente')
      }
    } catch (err) {
      console.error(err)
      alert('Error al procesar el evento')
    } finally {
      setCreating(false)
    }
  }

  const shareInvitation = () => {
    const url = `https://hotelpuntagaleria.mx/evento/${createdSlug}`
    const text = `¡Te invitamos a nuestro nuevo evento: ${events.find(e => e.slug === createdSlug)?.name || 'Evento'}! 🎉\n\nRegístrate aquí: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const copyInvitation = () => {
    const url = `https://hotelpuntagaleria.mx/evento/${createdSlug}`
    navigator.clipboard.writeText(url)
    alert('Enlace copiado al portapapeles')
  }

  useEffect(() => {
    // Bloquea el scroll del body — el scroll ocurre dentro de .sa-root
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([getEvents(), getAllActivityRegistrations()])
      .then(([evs, regs]) => {
        setEvents(evs)
        setAllRegs(regs)
        const eid = searchParams.get('eid')
        if (eid && evs.length > 0) {
          const ev = evs.find(e => String(e.id) === String(eid))
          if (ev) viewAttendees(ev)
        }
      })
      .catch(err => console.error('Error loading data:', err))
      .finally(() => setLoading(false))

    const timer = setTimeout(() => setShowSplash(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  const viewAllAttendees = (initialFilter = 'all') => {
    setSelectedEvent(null)
    setLoading(true)
    setView('attendees')
    setFilter(initialFilter)
    setSearch('')
    setAttendees(allRegs)
    setLoading(false)
  }

  const viewAttendees = async (ev, initialFilter = 'all') => {
    setSelectedEvent(ev)
    setLoading(true)
    setView('attendees')
    setFilter(initialFilter)
    setSearch('')
    try {
      const regs = await getActivityRegistrationsByEvent(ev.id)
      setAttendees(regs)
    } catch {
      setAttendees(allRegs.filter(r => String(r.event_id) === String(ev.id)))
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
    navigate('/checkin', { replace: true })
  }

  const handleScanQR = () => {
    if (onStartScan) onStartScan()
    else navigate('/checkin')
  }

  const handleNavAsistentes = () => {
    viewAllAttendees('all')
  }

  const handleNavConfirmados = () => {
    viewAllAttendees('confirmed')
  }

  const handleNavPendientes = () => {
    viewAllAttendees('pending')
  }

  const isCheckedIn = (r) => r.checked_in === 1 || r.checked_in === '1'
  const isPaid = (r) => r.paid === 1 || r.paid === '1'

  const totalConfirmed = allRegs.filter(isCheckedIn).length
  const totalPending = allRegs.filter(r => !isCheckedIn(r)).length

  const filteredAttendees = attendees.filter(a => {
    const matchSearch = (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.phone || '').includes(search)
    if (!matchSearch) return false
    if (filter === 'confirmed') return isCheckedIn(a)
    if (filter === 'pending') return !isCheckedIn(a)
    return true
  })

  const checkedCount = attendees.filter(isCheckedIn).length
  const pendingCount = attendees.length - checkedCount

  // ── Active tab logic ──
  const activeTab = view === 'dashboard'
    ? 'home'
    : view === 'create' || view === 'events_list' ? 'events'
    : filter === 'confirmed' ? 'confirmed'
    : filter === 'pending' ? 'pending'
    : 'asistentes'

  const handleNavHome = () => {
    setView('dashboard')
    setSelectedEvent(null)
    setCreatedSlug(null)
    setEditingId(null)
    navigate('/checkin', { replace: true })
  }

  const handleNavEvents = () => {
    setView('events_list')
    setSelectedEvent(null)
    setCreatedSlug(null)
    setEditingId(null)
  }

  // ── Shared Bottom Nav ──
  const BottomNav = () => (
    <nav className="sa-bottom-nav">
      <button
        className={`sa-bn-item ${activeTab === 'home' ? 'sa-bn-item--active' : ''}`}
        onClick={handleNavHome}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>Inicio</span>
      </button>

      <button
        className={`sa-bn-item ${activeTab === 'asistentes' ? 'sa-bn-item--active' : ''}`}
        onClick={handleNavAsistentes}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>Asistentes</span>
      </button>

      {/* QR center action */}
      <button className="sa-bn-item sa-bn-item--qr" onClick={handleScanQR}>
        <div className="sa-bn-qr-pill">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <path d="M14 14h3v3h-3zM18 17h3v3h-3zM14 18h3v3h-3zM18 14h3v3h-3z"/>
          </svg>
        </div>
        <span>Escanear</span>
      </button>

      {canCreate && (
        <button
          className={`sa-bn-item ${activeTab === 'events' ? 'sa-bn-item--active' : ''}`}
          onClick={handleNavEvents}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>Eventos</span>
        </button>
      )}

      <button
        className={`sa-bn-item ${activeTab === 'confirmed' ? 'sa-bn-item--active' : ''}`}
        onClick={handleNavConfirmados}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Confirmados</span>
      </button>
    </nav>
  )

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
            <div className="sa-top-left">
              <div className="sa-avatar-circle">{role === 'admin' ? 'A' : 'S'}</div>
              <div className="sa-greeting-block">
                <span className="sa-greeting-sub">Bienvenido</span>
                <span className="sa-greeting-role">{role === 'admin' ? 'Administrador' : 'Staff'}</span>
              </div>
            </div>
            <div className="sa-top-actions">
              <button className="sa-notif-btn" aria-label="Notificaciones">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span className="sa-notif-dot" />
              </button>
              <button className="sa-logout-btn" onClick={onLogout} aria-label="Salir">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4757" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="sa-hero-content">
            <p className="sa-hero-label">HOTEL PUNTA GALERÍA</p>
            <h1 className="sa-hero-title">Panel de Accesos</h1>
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
              <span className="sa-stat-num">{loading ? '…' : totalPending}</span>
              <span className="sa-stat-label">Pendientes</span>
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
            <div className="sa-empty"><p>No hay eventos activos</p></div>
          ) : (
            <div className="sa-event-list">
              {events.map((ev, idx) => {
                const evRegs = allRegs.filter(r => String(r.event_id) === String(ev.id))
                const registered = evRegs.length
                const capacity = Number(ev.capacity) || 0
                const checkedIn = evRegs.filter(isCheckedIn).length

                // Porcentaje basado en capacidad; sin capacidad usa registrados vs check-ins
                const pct = capacity > 0
                  ? Math.min(100, Math.round((registered / capacity) * 100))
                  : 0

                // Color dinámico según llenado
                const fillColor = pct >= 90
                  ? '#dc2626'        // rojo — casi lleno / lleno
                  : pct >= 65
                    ? '#d97706'      // naranja — llenándose
                    : '#838c2f'      // olivo — normal

                const statusLabel = capacity > 0
                  ? pct >= 100
                    ? '¡Lleno!'
                    : pct >= 90
                      ? '¡Casi lleno!'
                      : pct >= 65
                        ? 'Llenándose'
                        : 'Disponible'
                  : null

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
                        {capacity > 0 ? (
                          <span className="sa-progress-label">
                            <b style={{ color: fillColor }}>{registered}</b>
                            <span> / {capacity} lugares</span>
                            {checkedIn > 0 && (
                              <span style={{ color: '#236d00', marginLeft: 6, fontSize: 11 }}>· {checkedIn} confirmados</span>
                            )}
                          </span>
                        ) : (
                          <span className="sa-progress-label">
                            <b>{registered}</b> registrados
                            {checkedIn > 0 && (
                              <span style={{ color: '#236d00', marginLeft: 6, fontSize: 11 }}>· {checkedIn} confirmados</span>
                            )}
                          </span>
                        )}
                        <span className="sa-progress-pct" style={{ color: fillColor }}>
                          {capacity > 0 ? (
                            statusLabel ? `${pct}% · ${statusLabel}` : `${pct}%`
                          ) : ''}
                        </span>
                      </div>
                      {capacity > 0 && (
                        <div className="sa-bar-bg">
                          <div className="sa-bar-fill" style={{ width: `${pct}%`, background: fillColor }} />
                        </div>
                      )}
                    </div>

                    {/* Botones de compartir */}
                    {ev.slug && (
                      <div className="sa-event-share" onClick={e => e.stopPropagation()}>
                        <button
                          className={`sa-share-btn ${copiedId === ev.id ? 'sa-share-btn--copied' : ''}`}
                          onClick={e => handleCopyLink(ev, e)}
                        >
                          {copiedId === ev.id ? (
                            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>¡Copiado!</>
                          ) : (
                            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Copiar link</>
                          )}
                        </button>
                        <button className="sa-share-btn sa-share-btn--wa" onClick={e => handleShareWhatsApp(ev, e)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          WhatsApp
                        </button>
                        <button className="sa-share-btn sa-share-btn--share" onClick={e => handleNativeShare(ev, e)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                          Compartir
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {canCreate && view !== 'create' && (
          <button className="sa-fab" onClick={handleCreateView} aria-label="Nuevo Evento">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}

        <BottomNav />
      </div>
    )
  }

  // ── Events List View ──
  if (view === 'events_list') {
    return (
      <div className="sa-root">
        <div className="sa-sticky-top sa-top-gradient">
          <header className="sa-attendees-header">
            <button className="sa-back-btn" onClick={() => setView('dashboard')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div className="sa-header-titles">
              <span className="sa-h-title">Gestión de Eventos</span>
              <span className="sa-h-subtitle">{events.length} eventos registrados</span>
            </div>
            <button className="sa-top-btn" onClick={onLogout} aria-label="Salir">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4757" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </header>
        </div>

        <div className="sa-body">
          {loading ? (
            <div className="sa-skeleton-list">
              {[1, 2, 3].map(i => <div key={i} className="sa-skeleton sa-skeleton-card" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="sa-empty"><p>No hay eventos registrados</p></div>
          ) : (
            <div className="sa-event-list">
              {events.map((ev, idx) => (
                <div key={ev.id} className="sa-event-card" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className="sa-event-main" style={{ marginBottom: 0 }}>
                    <div className="sa-icon-box" style={{ background: '#f8fafc', color: '#64748b' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </div>
                    <div className="sa-ev-info">
                      <span className="sa-ev-name">{ev.name}</span>
                      <span className="sa-ev-date">{ev.date || 'Sin fecha'} • {ev.hora || 'Sin hora'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {ev.slug && (
                        <button
                          className="sa-edit-card-btn"
                          onClick={e => handleNativeShare(ev, e)}
                          style={{ background: '#eef0dc', color: '#626c1f' }}
                          title="Compartir enlace"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                          </svg>
                        </button>
                      )}
                      <button
                        className="sa-edit-card-btn"
                        onClick={() => handleEditEvent(ev)}
                        style={{ background: '#eef0dc', color: '#626c1f' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className="sa-edit-card-btn"
                        onClick={() => handleDeleteEvent(ev)}
                        style={{ background: '#fff1f2', color: '#ef4444' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canCreate && (
          <button className="sa-fab" onClick={handleCreateView} aria-label="Nuevo Evento">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}

        <BottomNav />
      </div>
    )
  }

  // ── Create View ──
  if (view === 'create') {
    if (createdSlug) {
      return (
        <div className="sa-root">
          <div className="sa-sticky-top sa-top-gradient">
            <header className="sa-attendees-header">
              <div className="sa-header-titles" style={{ marginLeft: 20 }}>
                <span className="sa-h-title">¡Evento Creado!</span>
                <span className="sa-h-subtitle">El evento ya está en vivo</span>
              </div>
            </header>
          </div>

          <div className="sa-create-view" style={{ textAlign: 'center' }}>
            <div className="sa-form" style={{ alignItems: 'center', gap: 24 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <h2 className="sa-form-title">¡Listo para compartir!</h2>
                <p className="sa-form-sub">Envía la invitación a tus contactos o copia el enlace.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                <button className="sa-submit-btn" onClick={shareInvitation} style={{ background: '#25d366', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)' }}>
                  Compartir en WhatsApp
                </button>
                <button className="sa-submit-btn" onClick={copyInvitation} style={{ background: '#f8fafc', color: '#1e293b', border: '1.5px solid #e2e8f0', boxShadow: 'none' }}>
                  Copiar Enlace
                </button>
                <button className="sa-bn-item" onClick={() => { setCreatedSlug(null); setView('dashboard') }} style={{ marginTop: 10 }}>
                  Volver al Inicio
                </button>
              </div>
            </div>
          </div>
          <BottomNav />
        </div>
      )
    }

    return (
      <div className="sa-root">
        <div className="sa-sticky-top sa-top-gradient">
          <header className="sa-attendees-header">
            <button className="sa-back-btn" onClick={goBack}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div className="sa-header-titles">
              <span className="sa-h-title">{editingId ? 'Editar Evento' : 'Nuevo Evento'}</span>
              <span className="sa-h-subtitle">{editingId ? 'Modifica los detalles' : 'Crea una nueva actividad'}</span>
            </div>
            <button className="sa-top-btn" onClick={onLogout} aria-label="Salir">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4757" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </header>
        </div>

        <div className="sa-create-view">
          <form onSubmit={handleCreateEvent} className="sa-form">
            <div className="sa-field">
              <label className="sa-label">Nombre del Evento</label>
              <input
                type="text"
                className="sa-input"
                placeholder="Ej: Yoga al amanecer"
                value={newEvt.name}
                onChange={e => setNewEvt({ ...newEvt, name: e.target.value })}
                required
              />
            </div>

            <div className="sa-grid-2">
              <div className="sa-field">
                <label className="sa-label">Fecha</label>
                <DatePicker
                  value={newEvt.date}
                  onChange={val => setNewEvt({ ...newEvt, date: val })}
                  placeholder="Seleccionar"
                />
              </div>
              <div className="sa-field">
                <label className="sa-label">Hora</label>
                <TimePicker
                  value={newEvt.time}
                  onChange={val => setNewEvt({ ...newEvt, time: val })}
                  placeholder="Seleccionar"
                  variant="input"
                />
              </div>
            </div>

            <div className="sa-grid-2">
              <div className="sa-field">
                <label className="sa-label">Precio ($)</label>
                <input
                  type="number"
                  className="sa-input"
                  placeholder="0.00"
                  value={newEvt.price}
                  onChange={e => setNewEvt({ ...newEvt, price: e.target.value })}
                />
              </div>
              <div className="sa-field">
                <label className="sa-label">Lugares</label>
                <input
                  type="number"
                  className="sa-input"
                  placeholder="Capacidad"
                  value={newEvt.capacity}
                  onChange={e => setNewEvt({ ...newEvt, capacity: e.target.value })}
                />
              </div>
            </div>

            <div className="sa-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="sa-label">Descripción</label>
                <button
                  type="button"
                  className="sa-ai-btn"
                  onClick={handleAiGenerate}
                  disabled={aiLoading}
                >
                  {aiLoading ? 'Generando...' : 'Generar con IA'}
                </button>
              </div>
              <textarea
                className="sa-input sa-textarea"
                placeholder="Detalles del evento..."
                value={newEvt.description}
                maxLength={DESC_MAX}
                onChange={e => setNewEvt({ ...newEvt, description: e.target.value })}
              />
              <span style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right', fontWeight: 700 }}>
                {newEvt.description.length} / {DESC_MAX}
              </span>
            </div>

            <button type="submit" className="sa-submit-btn" disabled={creating}>
              {creating ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Publicar Evento'}
            </button>
          </form>
        </div>

        <BottomNav />
      </div>
    )
  }

  // ── Attendees View ──
  return (
    <div className="sa-root">
      <div className="sa-sticky-top sa-top-gradient">
        <header className="sa-attendees-header">
          <button className="sa-back-btn" onClick={goBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="sa-header-titles">
            <span className="sa-h-title">{selectedEvent ? selectedEvent.name : 'Todos los Asistentes'}</span>
            <span className="sa-h-subtitle">{selectedEvent ? (selectedEvent.date || 'Sin fecha') : 'Registros globales del hotel'}</span>
          </div>
          <button className="sa-top-btn" onClick={onLogout} aria-label="Salir">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4757" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
        </header>

        <div className="sa-search-container">
          <div className="sa-search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sa-search-icon">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="sa-search-clear" onClick={() => setSearch('')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

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

        <div className="sa-filter-scroll">
          <button
            className="sa-filter-chip sa-filter-chip--event"
            onClick={() => setShowEventPicker(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M6 9l6 6 6-9"/>
            </svg>
            {selectedEvent ? selectedEvent.name : 'Todos'}
          </button>
          
          {Object.entries(FILTERS).map(([key, label]) => {
            if (key === 'all') return null // Handled by event picker chip
            return (
              <button
                key={key}
                className={`sa-filter-chip ${filter === key ? 'sa-filter-chip--active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {key === 'confirmed' && <span className="sa-chip-dot sa-chip-dot--ok" />}
                {key === 'pending' && <span className="sa-chip-dot sa-chip-dot--pending" />}
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {showEventPicker && (
        <div className="sa-picker-overlay" onClick={() => setShowEventPicker(false)}>
          <div className="sa-picker-sheet" onClick={e => e.stopPropagation()}>
            <div className="sa-picker-header">
              <span className="sa-picker-title">Seleccionar Evento</span>
              <button className="sa-picker-close" onClick={() => setShowEventPicker(false)}>✕</button>
            </div>
            <div className="sa-picker-list">
              <button 
                className={`sa-picker-item ${!selectedEvent ? 'sa-picker-item--sel' : ''}`}
                onClick={() => { viewAllAttendees(filter); setShowEventPicker(false) }}
              >
                <span>Todos los registros</span>
                {!selectedEvent && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              {events.map(ev => (
                <button 
                  key={ev.id}
                  className={`sa-picker-item ${selectedEvent?.id === ev.id ? 'sa-picker-item--sel' : ''}`}
                  onClick={() => { viewAttendees(ev, filter); setShowEventPicker(false) }}
                >
                  <span>{ev.name}</span>
                  {selectedEvent?.id === ev.id && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="sa-body">
        {loading ? (
          <div className="sa-attendee-list">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="sa-skeleton sa-skeleton-att" />)}
          </div>
        ) : (
          <div className={`sa-attendee-list ${search ? 'sa-searching' : ''}`}>
            {filteredAttendees.map((a, idx) => (
              <div key={a.id} className="sa-attendee-card" style={{ animationDelay: `${idx * 0.03}s` }} onClick={() => navigate(`/checkin?rid=${a.id}&eid=${selectedEvent?.id}`)}>
                <div className={`sa-status-dot ${isCheckedIn(a) ? 'sa-dot--confirmed' : 'sa-dot--pending'}`} />
                <div className="sa-att-info">
                  <span className="sa-att-name">{a.full_name}</span>
                  <span className="sa-att-phone">{a.phone}</span>
                </div>
                <div className="sa-att-tags">
                  <span className={`sa-tag ${isCheckedIn(a) ? 'sa-tag--paid' : 'sa-tag--pending'}`}>
                    {isCheckedIn(a) ? 'Confirmado' : 'Pendiente'}
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

      {canCreate && view !== 'create' && (
        <button className="sa-fab" onClick={handleCreateView} aria-label="Nuevo Evento">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      )}

      <BottomNav />
    </div>
  )
}
