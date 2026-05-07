import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getStats, clearEvents,
  adminLogin, adminHasUsers, adminCreateUser, adminGetUsers, adminDeleteUser, adminChangePassword, adminSetPermissions,
  getActivities, saveActivity, deleteActivity, updateActivity,
  getEvents, createEvent, updateEvent, deleteEvent, getRegistrationsByEvent,
  getAllActivityRegistrations, getEventByActivityId, upsertActivityEvent,
  deleteActivityRegistration, getActivityRegistrationsByEvent,
  deleteEventRegistration,
} from '../lib/turso'
import { getActivityIcon } from '../lib/activityIcons'
import SearchConsoleTab from './SearchConsoleTab'
import './AdminDashboard.css'

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fmtFecha(s) {
  if (!s) return ''
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${parseInt(m[3])} de ${MESES[parseInt(m[2]) - 1]}`
  return s
}

function fmtHora(s) {
  if (!s) return ''
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (m) {
    const h = parseInt(m[1])
    return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'pm' : 'am'}`
  }
  return s
}

const FALLBACK_PWD = import.meta.env.VITE_ADMIN_PASSWORD || 'hotel2024'

const PERIODS = [
  { label: '24H', days: 1 },
  { label: '7D',  days: 7 },
  { label: '28D', days: 28 },
  { label: '3M',  days: 90 },
  { label: 'Todo', days: 0 },
]

const PERMS_CONFIG = [
  { key: 'stats',         label: 'Estadísticas'  },
  { key: 'google',        label: 'Google'         },
  { key: 'actividades',   label: 'Actividades'    },
  { key: 'eventos',       label: 'Eventos'        },
  { key: 'inscripciones', label: 'Inscripciones'  },
]

// ── Labels ────────────────────────────────────────────────
const WA_LABELS = {
  float:           'Botón flotante',
  bot_contact:     'Bot — Contacto',
  bot_activity:    'Bot — Actividad',
  salon:           'Salón de eventos',
  restaurante:     'Restaurante',
  ubicacion:       'Ubicación',
  footer_social:   'Footer — Social',
  footer_reservar: 'Footer — Reservar',
  booking_modal:   'Modal de reserva',
}

const RESERVA_LABELS = {
  hero:         'Hero (portada)',
  rooms:        'Habitaciones',
  booking_modal: 'Modal de reserva',
}

// ── Helpers ──────────────────────────────────────────────
function cnt(data, type) {
  return Number(data?.find(r => r.event_type === type)?.cnt ?? 0)
}
function total(data) {
  return data?.reduce((s, r) => s + Number(r.cnt), 0) ?? 0
}
function diff(a, b) {
  const d = a - b
  return d === 0 ? null : d
}
function todayLabel() {
  return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).toUpperCase()
}
function clock() {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Fill last 14 days ────────────────────────────────────
function buildChartData(byDayType) {
  const days = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const map = {}
  byDayType?.forEach(r => {
    if (!map[r.day]) map[r.day] = {}
    map[r.day][r.event_type] = Number(r.cnt)
  })
  return days.map(day => ({
    day,
    label: day.slice(5),
    messages: map[day]?.bot_message ?? 0,
    whatsapp: map[day]?.whatsapp_click ?? 0,
  }))
}

// ── Smooth SVG line ──────────────────────────────────────
function smoothPath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i]
    const mx = (p.x + c.x) / 2
    d += ` C ${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`
  }
  return d
}

// ── Line chart ───────────────────────────────────────────
function LineChart({ data }) {
  if (!data?.length) return <p className="adm-chart-empty">Sin datos aún</p>

  const W = 600, H = 150, PL = 8, PR = 8, PT = 16, PB = 22
  const cW = W - PL - PR
  const cH = H - PT - PB
  const maxVal = Math.max(...data.map(d => Math.max(d.messages, d.whatsapp)), 1)
  const toX = i  => PL + (i / (data.length - 1)) * cW
  const toY = v  => PT + cH - (v / maxVal) * cH

  const mPts = data.map((d, i) => ({ x: toX(i), y: toY(d.messages) }))
  const wPts = data.map((d, i) => ({ x: toX(i), y: toY(d.whatsapp) }))

  const mLine = smoothPath(mPts)
  const wLine = smoothPath(wPts)
  const bottom = PT + cH
  const mArea = `${mLine} L ${mPts.at(-1).x},${bottom} L ${PL},${bottom} Z`
  const wArea = `${wLine} L ${wPts.at(-1).x},${bottom} L ${PL},${bottom} Z`

  const gridY = [0.25, 0.5, 0.75].map(f => PT + cH - f * cH)

  return (
    <div className="adm-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H + PB - 4}`} className="adm-svg-chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a8c2e" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#7a8c2e" stopOpacity="0.02"/>
          </linearGradient>
          <linearGradient id="gWA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#25d366" stopOpacity="0.14"/>
            <stop offset="100%" stopColor="#25d366" stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {gridY.map(y => (
          <line key={y} x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f3f3f3" strokeWidth="1"/>
        ))}
        <line x1={PL} y1={bottom} x2={W - PR} y2={bottom} stroke="#eee" strokeWidth="1"/>

        <path d={mArea} fill="url(#gMsg)"/>
        <path d={wArea} fill="url(#gWA)"/>

        <path d={mLine} fill="none" stroke="#7a8c2e" strokeWidth="2" strokeLinecap="round"/>
        <path d={wLine} fill="none" stroke="#25d366" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 3"/>

        {mPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#7a8c2e" strokeWidth="1.5"/>
        ))}
        {wPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" stroke="#25d366" strokeWidth="1.5"/>
        ))}

        {data.map((d, i) => (
          i % 2 === 0 && (
            <text key={i} x={toX(i)} y={H + PB - 6} textAnchor="middle" className="adm-chart-xlabel">
              {d.label}
            </text>
          )
        ))}
      </svg>

      <div className="adm-chart-legend">
        <span className="adm-legend-dot" style={{ background: '#7a8c2e' }} />
        <span className="adm-legend-text">Mensajes</span>
        <span className="adm-legend-dash" />
        <span className="adm-legend-text">WhatsApp</span>
      </div>
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────
function StatCard({ label, value, sub, Icon, delta: d }) {
  const positive = d > 0, negative = d < 0
  return (
    <div className="adm-card">
      <div className="adm-card__top">
        <span className="adm-card__label">{label}</span>
        <span className="adm-card__icon"><Icon /></span>
      </div>
      <div className="adm-card__num">{value ?? '–'}</div>
      <div className="adm-card__foot">
        <span className="adm-card__sub">{sub}</span>
        {d != null && (
          <span className={`adm-delta ${positive ? 'up' : negative ? 'down' : ''}`}>
            {positive ? `+${d}` : `${d}`}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Conversions ───────────────────────────────────────────
function ConversionList({ data, labels, color }) {
  const tot = data?.reduce((s, r) => s + Number(r.cnt), 0) ?? 0
  if (!data?.length) return <p className="adm-conv-empty">Sin datos aún</p>
  return (
    <div className="adm-conv-list">
      {data.map((r, i) => {
        const c   = Number(r.cnt)
        const pct = tot > 0 ? Math.round((c / tot) * 100) : 0
        return (
          <div key={i} className="adm-conv-item">
            <span className="adm-conv-src">{labels[r.source] ?? r.source ?? '—'}</span>
            <div className="adm-conv-bar-bg">
              <div className="adm-conv-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="adm-conv-num">{c}</span>
            <span className="adm-conv-pct">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Distribution ─────────────────────────────────────────
function Distribution({ byType }) {
  const t = total(byType)
  const rows = [
    { type: 'bot_open',       label: 'Bot abierto',      color: '#7a8c2e' },
    { type: 'bot_message',    label: 'Mensajes enviados', color: '#3b82f6' },
    { type: 'whatsapp_click', label: 'Clicks WhatsApp',   color: '#25d366' },
  ]
  return (
    <div className="adm-dist">
      {rows.map(r => {
        const c = cnt(byType, r.type)
        const pct = t > 0 ? Math.round((c / t) * 100) : 0
        return (
          <div key={r.type} className="adm-dist__row">
            <span className="adm-dist__dot" style={{ background: r.color }}/>
            <span className="adm-dist__label">{r.label}</span>
            <div className="adm-dist__bar-bg">
              <div className="adm-dist__bar-fill" style={{ width: `${pct}%`, background: r.color }}/>
            </div>
            <span className="adm-dist__num">{c}</span>
            <span className="adm-dist__pct">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Users section ─────────────────────────────────────────
function UsersSection({ currentUser }) {
  const [users, setUsers]       = useState([])
  const [loadingU, setLoadingU] = useState(false)
  const [newUser, setNewUser]   = useState('')
  const [newPwd, setNewPwd]     = useState('')
  const [showNew, setShowNew]   = useState(false)
  const [creating, setCreating] = useState(false)
  const [errU, setErrU]         = useState('')
  const [changePwd, setChangePwd] = useState({ open: false, user: '', val: '', show: false })
  const [permModal, setPermModal] = useState(null)
  const [savingPerms, setSavingPerms] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoadingU(true)
    setUsers(await adminGetUsers())
    setLoadingU(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const create = async (e) => {
    e.preventDefault()
    if (!newUser.trim() || newPwd.length < 6) { setErrU('Mínimo 6 caracteres en la contraseña'); return }
    setCreating(true); setErrU('')
    try {
      await adminCreateUser(newUser.trim(), newPwd)
      setNewUser(''); setNewPwd(''); loadUsers()
    } catch { setErrU('Error al crear usuario') }
    finally { setCreating(false) }
  }

  const del = async (id, username) => {
    if (username === currentUser) { alert('No puedes eliminar tu propio usuario'); return }
    if (!confirm(`¿Eliminar usuario "${username}"?`)) return
    await adminDeleteUser(id); loadUsers()
  }

  const saveChange = async (e) => {
    e.preventDefault()
    if (changePwd.val.length < 6) { setErrU('Mínimo 6 caracteres'); return }
    setCreating(true); setErrU('')
    try {
      await adminChangePassword(changePwd.user, changePwd.val)
      setChangePwd({ open: false, user: '', val: '', show: false })
    } catch { setErrU('Error al cambiar contraseña') }
    finally { setCreating(false) }
  }

  const togglePerm = async (key) => {
    if (!permModal) return
    const updated = { ...(permModal.permissions ?? {}), [key]: !(permModal.permissions?.[key]) }
    setPermModal(p => ({ ...p, permissions: updated }))
    setSavingPerms(true)
    try { await adminSetPermissions(permModal.id, updated) } finally { setSavingPerms(false); loadUsers() }
  }

  return (
    <div className="adm-users">
      <div className="adm-users__header">
        <span>Usuarios del sistema</span>
        <span className="adm-users__count">{users.length} usuario{users.length !== 1 ? 's' : ''}</span>
      </div>

      {loadingU ? (
        <p className="adm-users__loading">Cargando…</p>
      ) : (
        <div className="adm-users__list">
          {users.map(u => (
            <div key={u.id} className={`adm-user-row ${u.username === currentUser ? 'adm-user-row--me' : ''}`}>
              <span className="adm-user-row__icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </span>
              <span className="adm-user-row__name">
                {u.username}
                {u.username === currentUser && <span className="adm-user-row__you">tú</span>}
                <span className={`adm-role-badge${u.role === 'admin' ? ' adm-role-badge--admin' : ''}`}>{u.role === 'admin' ? 'Admin' : 'Editor'}</span>
              </span>
              <span className="adm-user-row__date">
                {String(u.created_at ?? '').slice(0, 10)}
              </span>
              {u.role !== 'admin' && (
                <button className="adm-user-row__btn" title="Permisos"
                  onClick={() => setPermModal({ ...u })}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </button>
              )}
              <button className="adm-user-row__btn" title="Cambiar contraseña"
                onClick={() => setChangePwd({ open: true, user: u.username, val: '', show: false })}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </button>
              <button className="adm-user-row__btn adm-user-row__btn--del" title="Eliminar"
                onClick={() => del(u.id, u.username)} disabled={u.username === currentUser}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Change password modal */}
      {changePwd.open && (
        <form onSubmit={saveChange} className="adm-users__change">
          <span className="adm-users__change-title">Nueva contraseña para <strong>{changePwd.user}</strong></span>
          <div className="adm-pw" style={{ flex: 1 }}>
            <input
              type={changePwd.show ? 'text' : 'password'}
              value={changePwd.val}
              onChange={e => setChangePwd(p => ({ ...p, val: e.target.value }))}
              placeholder="Nueva contraseña"
              className="adm-pw__input"
              autoFocus
            />
            <button type="button" className="adm-pw__eye" onClick={() => setChangePwd(p => ({ ...p, show: !p.show }))}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={creating}>Guardar</button>
          <button type="button" className="adm-btn-sm" onClick={() => setChangePwd({ open: false, user: '', val: '', show: false })}>Cancelar</button>
        </form>
      )}

      {/* Permissions modal */}
      {permModal && (
        <div className="adm-evt-modal-overlay" onClick={e => e.target === e.currentTarget && setPermModal(null)}>
          <div className="adm-evt-modal">
            <div className="adm-evt-modal__head">
              <span className="adm-users__change-title" style={{ margin: 0 }}>
                Permisos — <strong>{permModal.username}</strong>
              </span>
              <button className="adm-evt-modal__close" onClick={() => setPermModal(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="adm-perms__hint">Activa las secciones a las que este usuario puede acceder.</p>
            <div className="adm-perms__list">
              {PERMS_CONFIG.map(({ key, label }) => {
                const active = !!permModal.permissions?.[key]
                return (
                  <button key={key} type="button"
                    className={`adm-perms__row${active ? ' adm-perms__row--on' : ''}`}
                    onClick={() => togglePerm(key)}
                    disabled={savingPerms}>
                    <span className="adm-perms__label">{label}</span>
                    <span className={`adm-toggle${active ? ' adm-toggle--on' : ''}`}>
                      <span className="adm-toggle__knob"/>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add user */}
      <form onSubmit={create} className="adm-users__add">
        <input
          type="text"
          value={newUser}
          onChange={e => { setNewUser(e.target.value); setErrU('') }}
          placeholder="Nuevo usuario"
          className="adm-users__input"
        />
        <div className="adm-pw" style={{ flex: 1 }}>
          <input
            type={showNew ? 'text' : 'password'}
            value={newPwd}
            onChange={e => { setNewPwd(e.target.value); setErrU('') }}
            placeholder="Contraseña"
            className="adm-pw__input"
          />
          <button type="button" className="adm-pw__eye" onClick={() => setShowNew(s => !s)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={creating}>
          {creating ? '…' : '+ Crear'}
        </button>
      </form>
      {errU && <p className="adm-users__err">{errU}</p>}
    </div>
  )
}

const DIAS_REC = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábados','Domingos']

const FREC_REC = [
  { val: 'todas', label: 'Cada semana' },
  { val: 'sem13', label: 'Sem. 1 y 3'  },
  { val: 'sem24', label: 'Sem. 2 y 4'  },
]

const FREC_LABEL = { todas: '', sem13: ' · sem. 1 y 3', sem24: ' · sem. 2 y 4' }

function buildFecha(dia, frec) {
  // for weekly store "Todos los viernes"; for alternating just the day name
  return frec === 'todas' ? `Todos los ${dia.toLowerCase()}` : dia
}

function recoverRec(a) {
  const m = (a.fecha ?? '').match(/^Todos los (.+)$/)
  const raw = m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : (a.fecha ?? 'Viernes')
  const diaRec = DIAS_REC.find(d => d.toLowerCase() === raw.toLowerCase()) ?? 'Viernes'
  return { diaRec, frecRec: a.semanas ?? 'todas' }
}

function actSlug(name, id) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + id
}

// ── Activities section ────────────────────────────────────
function ActivitiesSection() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')
  const [createdModal, setCreatedModal] = useState(null)
  const [linkCopied, setLinkCopied]    = useState(false)

  // New activity form state
  const [newAct, setNewAct] = useState({
    name: '', fechaTipo: 'rec', fecha: '', diaRec: 'Viernes', frecRec: 'todas', hora: '',
    price: '', capacity: '', evtDate: '', description: '', showEvt: false,
  })

  // Event info per activity
  const [eventInfo, setEventInfo] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setActivities(await getActivities())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    activities.forEach(async (a) => {
      const numId = parseInt(a.id)
      if (isNaN(numId)) return
      const ev = await getEventByActivityId(numId)
      setEventInfo(prev => ({
        ...prev,
        [a.id]: {
          price: ev?.price ?? '',
          description: ev?.description ?? '',
          date: ev?.date ?? '',
          capacity: ev?.capacity ? String(ev.capacity) : '',
          hasEvent: !!ev,
        }
      }))
    })
  }, [activities])

  const startEdit = (a) => {
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(a.fecha ?? '')
    const tipo = isDate || !a.fecha ? 'fecha' : 'rec'
    const { diaRec: dr, frecRec: fr } = recoverRec(a)
    const ev = eventInfo[a.id] ?? {}
    setEditItem({
      id: a.id, name: a.name, tipo,
      fecha: isDate ? (a.fecha ?? '') : '',
      diaRec: dr, frecRec: fr, hora: a.hora ?? '',
      price: ev.price ?? '', description: ev.description ?? '',
      evtDate: ev.date ?? '', capacity: ev.capacity ?? '',
    })
    setErr('')
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editItem.name.trim()) return
    const fechaValue = editItem.tipo === 'fecha' ? editItem.fecha : buildFecha(editItem.diaRec, editItem.frecRec)
    const semanasValue = editItem.tipo === 'rec' ? editItem.frecRec : 'todas'
    setSaving(true); setErr('')
    try {
      await updateActivity(editItem.id, editItem.name.trim(), fechaValue, editItem.hora, semanasValue)
      const hasEvtData = editItem.price || editItem.description || editItem.capacity || editItem.evtDate || eventInfo[editItem.id]?.hasEvent
      if (hasEvtData) {
        await upsertActivityEvent(
          editItem.id, editItem.name.trim(),
          parseFloat(editItem.price) || 0,
          editItem.description.trim(),
          editItem.tipo === 'fecha' ? editItem.fecha : editItem.evtDate,
          parseInt(editItem.capacity) || 0,
        )
      }
      setEditItem(null); load()
    } catch { setErr('Error al guardar') }
    finally { setSaving(false) }
  }

  const add = async (e) => {
    e.preventDefault()
    if (!newAct.name.trim()) { setErr('Escribe el nombre de la actividad'); return }
    const fechaValue = newAct.fechaTipo === 'fecha' ? newAct.fecha : buildFecha(newAct.diaRec, newAct.frecRec)
    const semanasValue = newAct.fechaTipo === 'rec' ? newAct.frecRec : 'todas'
    setSaving(true); setErr('')
    try {
      const newId = await saveActivity(newAct.name.trim(), fechaValue, newAct.hora, semanasValue)
      const hasEvt = !!(newAct.price || newAct.capacity || newAct.description || newAct.evtDate)
      if (newId && hasEvt) {
        await upsertActivityEvent(
          newId, newAct.name.trim(),
          parseFloat(newAct.price) || 0,
          newAct.description.trim(),
          newAct.fechaTipo === 'fecha' ? newAct.fecha : newAct.evtDate,
          parseInt(newAct.capacity) || 0,
        )
      }
      const slug = newId ? actSlug(newAct.name.trim(), newId) : null
      setCreatedModal({ name: newAct.name.trim(), slug, hasEvt: !!(newId && hasEvt) })
      setNewAct({ name: '', fechaTipo: 'rec', fecha: '', diaRec: 'Viernes', frecRec: 'todas', hora: '', price: '', capacity: '', evtDate: '', description: '', showEvt: false })
      load()
    } catch { setErr('Error al guardar') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('¿Eliminar esta actividad?')) return
    await deleteActivity(id); load()
  }

  const setE = (k) => (e) => setEditItem(p => ({ ...p, [k]: e.target.value }))
  const setN = (k) => (v) => setNewAct(p => ({ ...p, [k]: typeof v === 'object' ? v.target.value : v }))

  const EventFieldsDivider = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 2px' }}>
      <div style={{ flex: 1, height: 1, background: '#e5e8d8' }}/>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#7a8c2e', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        Evento vinculado
      </span>
      <div style={{ flex: 1, height: 1, background: '#e5e8d8' }}/>
    </div>
  )

  return (
    <div className="adm-activities">
      <div className="adm-users__header">
        <span>Actividades</span>
        <span className="adm-users__count">{activities.length} activa{activities.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-users__list">
          {activities.length === 0 && (
            <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin actividades. Agrega la primera abajo.</p>
          )}
          {activities.map(a => {
            const ev = eventInfo[a.id]
            return (
              <div key={a.id} className="adm-act-row">
                <span className="adm-act-row__icon">{getActivityIcon(a.name)}</span>
                <div className="adm-act-row__info">
                  <span className="adm-act-row__name">
                    {a.name}
                    {a.semanas && a.semanas !== 'todas' && (
                      <span className="adm-act-badge">{FREC_LABEL[a.semanas]?.trim()}</span>
                    )}
                    {ev?.hasEvent && (
                      <span className="adm-act-badge adm-act-badge--evt">
                        {ev.price > 0 ? `$${parseFloat(ev.price).toFixed(0)}` : ''}
                        {ev.price > 0 && ev.capacity > 0 ? ' · ' : ''}
                        {ev.capacity > 0 ? `${ev.capacity} lugares` : ''}
                        {!ev.price && !ev.capacity ? 'Con evento' : ''}
                      </span>
                    )}
                  </span>
                  {(a.fecha || a.hora) && (
                    <span className="adm-act-row__when">
                      {fmtFecha(a.fecha)}{a.hora ? ' · ' + fmtHora(a.hora) : ''}
                    </span>
                  )}
                  {ev?.description && (
                    <span className="adm-act-row__when" style={{ color: '#7a8c2e', fontStyle: 'italic' }}>
                      {ev.description}
                    </span>
                  )}
                </div>
                <button className="adm-user-row__btn" onClick={() => startEdit(a)} title="Editar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => del(a.id)} title="Eliminar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Edit modal ── */}
      {editItem && (
        <div className="adm-evt-modal-overlay" onClick={e => e.target === e.currentTarget && setEditItem(null)}>
          <div className="adm-evt-modal">
            <div className="adm-evt-modal__head">
              <span className="adm-users__change-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{getActivityIcon(editItem.name)}</span>
                {editItem.name}
              </span>
              <button className="adm-evt-modal__close" onClick={() => setEditItem(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={saveEdit} className="adm-act-edit">
              <input type="text" value={editItem.name} onChange={setE('name')} placeholder="Nombre" className="adm-users__input adm-act-form__name" autoFocus />

              <div className="adm-act-tipo">
                <button type="button" className={editItem.tipo === 'fecha' ? 'active' : ''} onClick={() => setEditItem(p => ({...p, tipo: 'fecha', evtDate: ''}))}>Fecha específica</button>
                <button type="button" className={editItem.tipo === 'rec'   ? 'active' : ''} onClick={() => setEditItem(p => ({...p, tipo: 'rec',   fecha: ''}))}>Recurrente</button>
              </div>
              {editItem.tipo === 'fecha' ? (
                <DatePicker key="edit-fecha" value={editItem.fecha} onChange={v => setEditItem(p => ({...p, fecha: v}))} placeholder="Fecha específica" />
              ) : (
                <div className="adm-act-rec-wrap">
                  <select value={editItem.diaRec} onChange={setE('diaRec')} className="adm-users__input">
                    {DIAS_REC.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={editItem.frecRec} onChange={setE('frecRec')} className="adm-users__input">
                    {FREC_REC.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
                  </select>
                </div>
              )}
              <TimePicker value={editItem.hora} onChange={v => setEditItem(p => ({...p, hora: v}))} placeholder="Hora" variant="input" />

              <EventFieldsDivider />
              <div className="adm-act-evt-grid">
                <input type="number" step="0.01" min="0" value={editItem.price} onChange={setE('price')} placeholder="Precio ($)" className="adm-users__input" />
                <input type="number" min="0" value={editItem.capacity} onChange={setE('capacity')} placeholder="Lugares (capacidad)" className="adm-users__input" />
              </div>
              <DescField
                value={editItem.description}
                onChange={setE('description')}
                name={editItem.name}
                price={editItem.price}
                date={editItem.tipo === 'fecha' ? editItem.fecha : editItem.evtDate}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving} style={{ flex: 1 }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                <button type="button" className="adm-btn-sm" onClick={() => setEditItem(null)}>Cancelar</button>
              </div>
              {err && <p className="adm-users__err">{err}</p>}
            </form>
          </div>
        </div>
      )}

      {/* ── Add form ── */}
      <form onSubmit={add} className="adm-act-form">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="adm-act-form__preview">{getActivityIcon(newAct.name)}</span>
          <input type="text" value={newAct.name}
            onChange={e => { setN('name')(e); setErr('') }}
            placeholder="Nombre de la actividad (ej: Yoga, Pilates…)"
            className="adm-users__input adm-act-form__name" style={{ flex: 1 }} />
        </div>

        <div className="adm-act-tipo">
          <button type="button" className={newAct.fechaTipo === 'fecha' ? 'active' : ''} onClick={() => setNewAct(p => ({...p, fechaTipo: 'fecha', evtDate: ''}))}>Fecha específica</button>
          <button type="button" className={newAct.fechaTipo === 'rec'   ? 'active' : ''} onClick={() => setNewAct(p => ({...p, fechaTipo: 'rec',   fecha:   ''}))}>Recurrente</button>
        </div>
        {newAct.fechaTipo === 'fecha' ? (
          <DatePicker key="new-fecha" value={newAct.fecha} onChange={setN('fecha')} placeholder="Fecha específica" />
        ) : (
          <div className="adm-act-rec-wrap">
            <select value={newAct.diaRec} onChange={setN('diaRec')} className="adm-users__input">
              {DIAS_REC.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={newAct.frecRec} onChange={setN('frecRec')} className="adm-users__input">
              {FREC_REC.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
            </select>
          </div>
        )}
        <TimePicker value={newAct.hora} onChange={setN('hora')} placeholder="Hora" variant="input" />

        <button type="button"
          className="adm-act-toggle-evt"
          onClick={() => setN('showEvt')(!newAct.showEvt)}>
          {newAct.showEvt ? '▾ Ocultar detalles del evento' : '▸ Agregar precio / capacidad / fecha de evento'}
        </button>

        {newAct.showEvt && (
          <>
            <EventFieldsDivider />
            <div className="adm-act-evt-grid">
              <input type="number" step="0.01" min="0" value={newAct.price} onChange={setN('price')} placeholder="Precio ($)" className="adm-users__input" />
              <input type="number" min="0" value={newAct.capacity} onChange={setN('capacity')} placeholder="Lugares" className="adm-users__input" />
            </div>
            <DescField
              value={newAct.description}
              onChange={setN('description')}
              name={newAct.name}
              price={newAct.price}
              date={newAct.fechaTipo === 'fecha' ? newAct.fecha : newAct.evtDate}
            />
          </>
        )}

        <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving} style={{ marginTop: 4 }}>
          {saving ? 'Guardando…' : '+ Crear actividad'}
        </button>
        {err && <p className="adm-users__err">{err}</p>}
      </form>

      {/* ── Created modal ── */}
      {createdModal && (
        <div className="adm-evt-modal-overlay" onClick={e => e.target === e.currentTarget && setCreatedModal(null)}>
          <div className="adm-evt-modal adm-created-modal">
            <button className="adm-evt-modal__close" style={{ alignSelf: 'flex-end' }} onClick={() => { setCreatedModal(null); setLinkCopied(false) }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="adm-created-modal__check">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="adm-created-modal__title">¡{createdModal.name} creada!</h3>
            {createdModal.hasEvt ? (
              <>
                <p className="adm-created-modal__sub">Comparte el enlace de inscripción con tus clientes.</p>
                <div className="adm-created-modal__actions">
                  <button
                    className={`adm-created-modal__copy${linkCopied ? ' adm-created-modal__copy--ok' : ''}`}
                    onClick={() => {
                      const link = `${window.location.origin}/evento/${createdModal.slug}`
                      if (navigator.clipboard) { navigator.clipboard.writeText(link) }
                      else { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
                      setLinkCopied(true)
                      setTimeout(() => setLinkCopied(false), 2200)
                    }}>
                    {linkCopied
                      ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> ¡Copiado!</>
                      : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copiar enlace</>
                    }
                  </button>
                  <button
                    className="adm-created-modal__wa"
                    onClick={() => {
                      const link = `${window.location.origin}/evento/${createdModal.slug}`
                      const msg = `¡Apúntate a *${createdModal.name}*! Regístrate aquí: ${link}`
                      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.874L0 24l6.294-1.51A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 0 1-5.002-1.368l-.36-.214-3.733.895.944-3.624-.234-.373A9.808 9.808 0 0 1 2.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
                    Compartir por WhatsApp
                  </button>
                </div>
              </>
            ) : (
              <p className="adm-created-modal__sub">La actividad se agregó a la lista.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Activity Registrations view ──────────────────────────
function ActivityRegistrationsSection({ dateFrom = '', dateTo = '' }) {
  const [regs, setRegs]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [evtFilter, setEvtFilter] = useState('')
  const [howFilter, setHowFilter] = useState('')
  const [sortKey, setSortKey]     = useState('date')
  const [sortDir, setSortDir]     = useState('desc')

  const loadRegs = useCallback(async () => {
    setLoading(true)
    const d = await getAllActivityRegistrations()
    setRegs(d)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRegs()
  }, [loadRegs])

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Eliminar la inscripción de ${name}?`)) return
    try {
      await deleteActivityRegistration(id)
      loadRegs()
    } catch {
      alert('Error al eliminar')
    }
  }

  const getLabel = (r) => r.event_name?.trim() || r.activity_name?.trim() || 'Sin evento'

  const evtCounts = regs.reduce((acc, r) => { const k = getLabel(r); acc[k] = (acc[k] || 0) + 1; return acc }, {})
  const howCounts = regs.reduce((acc, r) => { const k = r.how_found || '—'; acc[k] = (acc[k] || 0) + 1; return acc }, {})

  const evtLabels = Object.keys(evtCounts).sort()
  const howLabels = Object.keys(howCounts).sort()

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortIcon = (key) => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓'

  const afterFilters = regs.filter(r => {
    if (evtFilter && getLabel(r) !== evtFilter) return false
    if (howFilter && (r.how_found || '—') !== howFilter) return false
    if (dateFrom || dateTo) {
      const d = r.created_at ? r.created_at.slice(0, 10) : ''
      if (dateFrom && d < dateFrom) return false
      if (dateTo   && d > dateTo)   return false
    }
    return true
  })

  const sorted = [...afterFilters].sort((a, b) => {
    let va, vb
    if (sortKey === 'event')     { va = getLabel(a);        vb = getLabel(b) }
    else if (sortKey === 'name') { va = a.full_name ?? '';  vb = b.full_name ?? '' }
    else if (sortKey === 'how')  { va = a.how_found ?? '';  vb = b.how_found ?? '' }
    else                         { va = a.created_at ?? ''; vb = b.created_at ?? '' }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const hasFilters = evtFilter || howFilter || dateFrom || dateTo

  return (
    <div className="adm-activities">
      <div className="adm-users__header">
        <span>Inscripciones</span>
        <span className="adm-users__count">
          {sorted.length}{hasFilters ? ` de ${regs.length}` : ' en total'}
        </span>
      </div>

      {!loading && evtLabels.length > 0 && (
        <div className="adm-ins-filters">
          <div className="adm-ins-group">
            <p className="adm-ins-group-label">Evento</p>
            <div className="adm-ins-summary">
              {evtLabels.map(label => (
                <button key={label}
                  className={`adm-ins-card ${evtFilter === label ? 'adm-ins-card--active' : ''}`}
                  onClick={() => setEvtFilter(f => f === label ? '' : label)}>
                  <span className="adm-ins-card__count">{evtCounts[label]}</span>
                  <span className="adm-ins-card__label">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="adm-ins-group">
            <p className="adm-ins-group-label">Canal</p>
            <div className="adm-ins-summary">
              {howLabels.map(label => (
                <button key={label}
                  className={`adm-ins-card adm-ins-card--how ${howFilter === label ? 'adm-ins-card--active' : ''}`}
                  onClick={() => setHowFilter(f => f === label ? '' : label)}>
                  <span className="adm-ins-card__count">{howCounts[label]}</span>
                  <span className="adm-ins-card__label">{label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Filtros activos */}
      {hasFilters && (
        <div className="adm-ins-filterbar">
          {evtFilter && <span className="adm-ins-chip">Evento: <strong>{evtFilter}</strong><button onClick={() => setEvtFilter('')}>✕</button></span>}
          {howFilter && <span className="adm-ins-chip adm-ins-chip--how">Canal: <strong>{howFilter}</strong><button onClick={() => setHowFilter('')}>✕</button></span>}
          {(dateFrom || dateTo) && (
            <span className="adm-ins-chip adm-ins-chip--date">
              {dateFrom || '…'} → {dateTo || '…'}
            </span>
          )}
          <button className="adm-ins-clear" onClick={() => { setEvtFilter(''); setHowFilter('') }}>Limpiar filtros</button>
        </div>
      )}

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-registrations-table">
          {sorted.length === 0 ? (
            <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin inscripciones con estos filtros</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th className="adm-th-sort" onClick={() => toggleSort('event')}>Evento{sortIcon('event')}</th>
                  <th className="adm-th-sort" onClick={() => toggleSort('name')}>Nombre{sortIcon('name')}</th>
                  <th>Teléfono</th>
                  <th>Pago</th>
                  <th className="adm-th-sort" onClick={() => toggleSort('how')}>¿Cómo se enteró?{sortIcon('how')}</th>
                  <th className="adm-th-sort" onClick={() => toggleSort('date')}>Fecha{sortIcon('date')}</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id}>
                    <td><strong>{getLabel(r)}</strong></td>
                    <td>{r.full_name}</td>
                    <td>{r.phone}</td>
                    <td>
                      {r.payment_method === 'transferencia'
                        ? <span className="adm-pay-badge adm-pay-badge--transfer">Transferencia</span>
                        : r.payment_method === 'presencial'
                          ? <span className="adm-pay-badge adm-pay-badge--presencial">Presencial</span>
                          : <span className="adm-pay-badge">—</span>
                      }
                    </td>
                    <td>
                      <span className="adm-how-badge">{r.how_found || '—'}</span>
                    </td>
                    <td className="adm-table__date">{new Date(r.created_at).toLocaleDateString('es-MX')}</td>
                    <td>
                      <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => handleDelete(r.id, r.full_name)} title="Eliminar">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── AI Description Field ─────────────────────────────────
const DESC_MAX = 200

function DescField({ value, onChange, name, price, date }) {
  const [loading, setLoading] = useState(false)
  const remaining = DESC_MAX - (value?.length ?? 0)

  const generate = async () => {
    if (!name?.trim()) { alert('Escribe primero el nombre'); return }
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/ai-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price: parseFloat(price) || 0, date, maxLen: DESC_MAX }),
      })
      const data = await res.json()
      if (data.description) onChange({ target: { value: data.description } })
    } catch { alert('Error al generar') }
    finally { setLoading(false) }
  }

  return (
    <div className="adm-desc-wrap">
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder="Descripción"
        className="adm-users__input"
        maxLength={DESC_MAX}
      />
      <div className="adm-desc-bar">
        <span className={`adm-desc-count ${remaining < 30 ? 'adm-desc-count--warn' : ''}`}>
          {remaining} car.
        </span>
        <button type="button" className="adm-desc-ai" onClick={generate} disabled={loading}>
          {loading
            ? <span className="adm-desc-spin"/>
            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> IA</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser]   = useState('')
  const [pwd, setPwd]     = useState('')
  const [show, setShow]   = useState(false)
  const [err, setErr]     = useState('')
  const [busy, setBusy]   = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!user.trim() || !pwd) return
    setBusy(true); setErr('')
    try {
      const hasUsers = await adminHasUsers()
      if (!hasUsers) {
        const ok = pwd === FALLBACK_PWD
        if (ok) onLogin(user.trim(), true, 'admin', null)
        else { setErr('Usuario o contraseña incorrectos'); setPwd('') }
      } else {
        const result = await adminLogin(user.trim(), pwd)
        if (result.ok) onLogin(user.trim(), false, result.role, result.permissions)
        else { setErr('Usuario o contraseña incorrectos'); setPwd('') }
      }
    } catch { setErr('Error de conexión') }
    finally { setBusy(false) }
  }

  return (
    <div className="adm-login">
      <div className="adm-login__accent"/>
      <div className="adm-login__logo-wrap">
        <img src="/logo/logoNegro.svg" alt="Hotel Punta Galería" className="adm-login__logo"/>
      </div>
      <h2 className="adm-login__title">PANEL ADMIN</h2>
      <p className="adm-login__sub">
        <span className="adm-login__line"/>
        HOTEL PUNTA GALERÍA
        <span className="adm-login__line"/>
      </p>
      <form onSubmit={submit} className="adm-login__form">
        <input
          type="text"
          value={user}
          onChange={e => { setUser(e.target.value); setErr('') }}
          placeholder="Usuario"
          className="adm-pw__input"
          autoFocus
          autoComplete="username"
        />
        <div className="adm-pw">
          <input
            type={show ? 'text' : 'password'}
            value={pwd}
            onChange={e => { setPwd(e.target.value); setErr('') }}
            placeholder="Contraseña"
            className="adm-pw__input"
            autoComplete="current-password"
          />
          <button type="button" className="adm-pw__eye" onClick={() => setShow(s => !s)} aria-label="Mostrar">
            {show
              ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        </div>
        {err && <p className="adm-pw__err">{err}</p>}
        <button type="submit" className="adm-login__btn" disabled={busy}>
          {busy ? 'Verificando…' : 'Continuar →'}
        </button>
      </form>
      <p className="adm-login__hint">Ctrl + K para abrir / cerrar</p>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────
// ── Slug helper ──────────────────────────────────
function toSlug(name) {
  if (!name || typeof name !== 'string') return ''
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Events section ────────────────────────────────
function EventosSection() {
  const [events, setEvents] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [regLoading, setRegLoading] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newEventForm, setNewEventForm] = useState({ name: '', slug: '', price: '', date: '', description: '', capacity: '', activity_id: '', slugManual: false })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [evts, acts] = await Promise.all([getEvents(), getActivities()])
    setEvents(evts)
    setActivities(acts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const viewRegistrations = async (event) => {
    setSelectedEvent(event)
    setRegLoading(true)
    const [r1, r2] = await Promise.all([
      getRegistrationsByEvent(event.id),
      getActivityRegistrationsByEvent(event.id)
    ])
    // Combine and normalize
    const combined = [
      ...r1.map(r => ({ ...r, source: 'event' })),
      ...r2.map(r => ({ ...r, source: 'activity', email: '—', notes: r.how_found || '—' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setRegistrations(combined)
    setRegLoading(false)
  }

  const handleDeleteReg = async (id, name, source) => {
    if (!confirm(`¿Eliminar la inscripción de ${name}?`)) return
    try {
      if (source === 'activity') await deleteActivityRegistration(id)
      else if (source === 'event') await deleteEventRegistration(id)
      viewRegistrations(selectedEvent)
    } catch {
      alert('Error al eliminar')
    }
  }

  const startEdit = (e) => {
    setEditItem({ id: e.id, name: e.name, slug: e.slug, price: e.price ?? '', date: e.date ?? '', description: e.description ?? '', capacity: e.capacity ?? '', activity_id: e.activity_id ?? '' })
    setErr('')
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editItem.name.trim() || !editItem.slug.trim()) return
    setSaving(true); setErr('')
    try {
      await updateEvent(editItem.id, editItem.name.trim(), editItem.slug.trim(), parseFloat(editItem.price) || 0, editItem.description.trim(), editItem.date, parseInt(editItem.capacity) || 0, editItem.activity_id || null)
      setEditItem(null); load()
    } catch { setErr('Error al guardar') }
    finally { setSaving(false) }
  }

  const addEvent = async (e) => {
    e.preventDefault()
    if (!newEventForm.name.trim() || !newEventForm.slug.trim()) { setErr('Nombre y slug son requeridos'); return }
    setSaving(true); setErr('')
    try {
      await createEvent(newEventForm.name.trim(), newEventForm.slug.trim(), parseFloat(newEventForm.price) || 0, newEventForm.description.trim(), newEventForm.date, parseInt(newEventForm.capacity) || 0, newEventForm.activity_id || null)
      setNewEventForm({ name: '', slug: '', price: '', date: '', description: '', capacity: '', activity_id: '', slugManual: false })
      setShowNewModal(false)
      load()
    } catch (e) { setErr('Error al guardar: ' + e.message) }
    finally { setSaving(false) }
  }

  const delEvent = async (id) => {
    if (!confirm('¿Eliminar este evento?')) return
    await deleteEvent(id); load()
  }

  const copyLink = (id, slug) => {
    const cleanSlug = slug.replace(/-\d+$/, '')
    const link = `${window.location.origin}/evento/${cleanSlug}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link)
    } else {
      const ta = document.createElement('textarea')
      ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2200)
  }

  const shareWhatsApp = (slug, name) => {
    const cleanSlug = slug.replace(/-\d+$/, '')
    const link = `${window.location.origin}/evento/${cleanSlug}`
    const msg = `¡Apúntate a *${name}*! Regístrate aquí: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const set = (k) => (e) => setEditItem(p => ({ ...p, [k]: e.target.value }))
  const setNew = (k) => (e) => {
    const val = e.target.value
    setNewEventForm(p => {
      if (k === 'name' && !p.slugManual) return { ...p, name: val, slug: toSlug(val) }
      if (k === 'slug') return { ...p, slug: val, slugManual: val.length > 0 }
      return { ...p, [k]: val }
    })
  }

  if (selectedEvent) {
    return (
      <div className="adm-eventos">
        <div className="adm-users__header">
          <button className="adm-btn-sm" onClick={() => setSelectedEvent(null)}>← Volver</button>
          <span>{selectedEvent.name} — Inscritos</span>
          <span className="adm-users__count">{registrations.length}</span>
        </div>
        {regLoading ? <p className="adm-users__loading">Cargando…</p> : (
          <div className="adm-registrations-table">
            {registrations.length === 0 ? (
              <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin inscripciones aún</p>
            ) : (
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email / Canal</th>
                    <th>Teléfono</th>
                    <th>Notas</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={`${r.source}-${r.id}`}>
                      <td>{r.full_name}</td>
                      <td>{r.email !== '—' ? r.email : <span className="adm-how-badge">{r.notes}</span>}</td>
                      <td>{r.phone}</td>
                      <td>{r.email !== '—' ? r.notes : '—'}</td>
                      <td>
                        <span className={`adm-pay-badge ${r.source === 'activity' ? 'adm-pay-badge--transfer' : ''}`}>
                          {r.source === 'activity' ? 'Actividad' : 'Evento'}
                        </span>
                      </td>
                      <td className="adm-table__date">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => handleDeleteReg(r.id, r.full_name, r.source)} title="Eliminar">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Form shared between modal (new) and inline (edit) ──
  const EventForm = ({ isNew }) => (
    <form onSubmit={isNew ? addEvent : saveEdit} className="adm-evt-form-inner">
      <input type="text" value={isNew ? newEventForm.name : editItem.name}
        onChange={isNew ? setNew('name') : set('name')}
        placeholder="Nombre del evento" className="adm-users__input" autoFocus />
      <input type="text" value={isNew ? newEventForm.slug : editItem.slug}
        onChange={isNew ? setNew('slug') : set('slug')}
        placeholder="Slug (URL automático)" className="adm-users__input" />
      <div className="adm-evt-row2">
        <input type="number" step="0.01" value={isNew ? newEventForm.price : editItem.price}
          onChange={isNew ? setNew('price') : set('price')} placeholder="Precio ($)" className="adm-users__input" />
        <input type="number" value={isNew ? newEventForm.capacity : editItem.capacity}
          onChange={isNew ? setNew('capacity') : set('capacity')} placeholder="Lugares" className="adm-users__input" />
      </div>
      <DatePicker
        value={isNew ? newEventForm.date : editItem.date}
        onChange={v => isNew ? setNewEventForm(p => ({...p, date: v})) : setEditItem(p => ({...p, date: v}))}
        placeholder="Fecha del evento"
      />
      <DescField
        value={isNew ? newEventForm.description : editItem.description}
        onChange={isNew ? setNew('description') : set('description')}
        name={isNew ? newEventForm.name : editItem?.name}
        price={isNew ? newEventForm.price : editItem?.price}
        date={isNew ? newEventForm.date : editItem?.date}
      />
      <select value={isNew ? newEventForm.activity_id : (editItem?.activity_id ?? '')}
        onChange={isNew ? setNew('activity_id') : set('activity_id')} className="adm-users__input">
        <option value="">{isNew ? '— Vincular a actividad (opcional) —' : '— Sin vincular a actividad —'}</option>
        {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {err && <p className="adm-err-msg">{err}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Guardando…' : isNew ? 'Crear evento' : 'Guardar cambios'}
        </button>
        <button type="button" className="adm-btn-sm"
          onClick={() => isNew ? (setShowNewModal(false), setErr('')) : setEditItem(null)}>
          Cancelar
        </button>
      </div>
    </form>
  )

  return (
    <div className="adm-eventos">
      {/* Header with "+ Nuevo evento" button */}
      <div className="adm-users__header">
        <span>Eventos</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="adm-users__count">{events.length} evento{events.length !== 1 ? 's' : ''}</span>
          <button className="adm-btn-sm adm-btn-sm--green" onClick={() => { setShowNewModal(true); setErr('') }} style={{ padding: '4px 12px', fontSize: 12 }}>
            + Nuevo evento
          </button>
        </div>
      </div>

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-users__list">
          {events.length === 0 && (
            <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin eventos. Crea el primero con "+ Nuevo evento".</p>
          )}
          {events.map(e => {
            const linkedAct = activities.find(a => String(a.id) === String(e.activity_id))
            return (
              <div key={e.id} className="adm-evt-row">
                <div className="adm-evt-row__info">
                  <span className="adm-evt-row__name">
                    {e.name}
                    {linkedAct && (
                      <span className="adm-act-badge adm-act-badge--linked">
                        <span className="adm-badge-icon">{getActivityIcon(linkedAct.name)}</span>
                        {linkedAct.name}
                      </span>
                    )}
                  </span>
                  {e.date && <span className="adm-evt-row__when">{fmtFecha(e.date)}</span>}
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    {e.price > 0 && <span className="adm-act-badge adm-act-badge--evt">${parseFloat(e.price).toFixed(0)}</span>}
                    {e.capacity > 0 && <span className="adm-act-badge" style={{ fontSize: 10 }}>{e.capacity} lugares</span>}
                  </span>
                </div>
                <button className={`adm-user-row__btn${copiedId === e.id ? ' adm-user-row__btn--copied' : ''}`} onClick={() => copyLink(e.id, e.slug)} title="Copiar link">
                  {copiedId === e.id
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  }
                </button>
                <button className="adm-user-row__btn adm-user-row__btn--wa" onClick={() => shareWhatsApp(e.slug, e.name)} title="Compartir por WhatsApp">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.874L0 24l6.294-1.51A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 0 1-5.002-1.368l-.36-.214-3.733.895.944-3.624-.234-.373A9.808 9.808 0 0 1 2.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
                </button>
                <button className="adm-user-row__btn" onClick={() => viewRegistrations(e)} title="Ver inscritos">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </button>
                <button className="adm-user-row__btn" onClick={() => { startEdit(e); setShowNewModal(false) }} title="Editar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => delEvent(e.id)} title="Eliminar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit event modal */}
      {editItem && (
        <div className="adm-evt-modal-overlay" onClick={e => e.target === e.currentTarget && setEditItem(null)}>
          <div className="adm-evt-modal">
            <div className="adm-evt-modal__head">
              <span className="adm-users__change-title" style={{ margin: 0 }}>Editar — {editItem.name}</span>
              <button className="adm-evt-modal__close" onClick={() => setEditItem(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <EventForm isNew={false} />
          </div>
        </div>
      )}

      {/* New event modal */}
      {showNewModal && (
        <div className="adm-evt-modal-overlay" onClick={e => e.target === e.currentTarget && (setShowNewModal(false), setErr(''))}>
          <div className="adm-evt-modal">
            <div className="adm-evt-modal__head">
              <span className="adm-users__change-title" style={{ margin: 0 }}>Nuevo evento</span>
              <button className="adm-evt-modal__close" onClick={() => { setShowNewModal(false); setErr('') }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <EventForm isNew={true} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Custom DatePicker ─────────────────────────────────────
const DIAS = ['D','L','M','X','J','V','S']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function DatePicker({ value, onChange, placeholder = 'Fecha' }) {
  const [open, setOpen]   = useState(false)
  const [view, setView]   = useState(() => {
    if (value) { const d = new Date(value + 'T00:00:00'); return { y: d.getFullYear(), m: d.getMonth() } }
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }
  })
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    if (value) { const d = new Date(value + 'T00:00:00'); setView({ y: d.getFullYear(), m: d.getMonth() }) }
  }, [value])

  const today = new Date()
  today.setHours(0,0,0,0)

  const firstDay = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()

  function prevMonth() { setView(v => v.m === 0 ? { y: v.y-1, m: 11 } : { y: v.y, m: v.m-1 }) }
  function nextMonth() { setView(v => v.m === 11 ? { y: v.y+1, m: 0 } : { y: v.y, m: v.m+1 }) }

  function selectDay(day) {
    const mm = String(view.m + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${view.y}-${mm}-${dd}`)
    setOpen(false)
  }

  function clear(e) { e.stopPropagation(); onChange('') }

  const displayVal = value
    ? (() => { const d = new Date(value + 'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` })()
    : ''

  const selectedDay = value
    ? (() => { const d = new Date(value + 'T00:00:00'); return d.getFullYear() === view.y && d.getMonth() === view.m ? d.getDate() : null })()
    : null

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="adm-dp" ref={ref}>
      <button type="button" className={`adm-dp__trigger ${value ? 'adm-dp__trigger--set' : ''}`} onClick={() => setOpen(o => !o)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{displayVal || placeholder}</span>
        {value && <span className="adm-dp__clear" onClick={clear}>✕</span>}
      </button>
      {open && (
        <div className="adm-dp__cal">
          <div className="adm-dp__cal-head">
            <button type="button" className="adm-dp__nav" onClick={prevMonth}>‹</button>
            <span className="adm-dp__cal-title">{MESES_CORTOS[view.m]} {view.y}</span>
            <button type="button" className="adm-dp__nav" onClick={nextMonth}>›</button>
          </div>
          <div className="adm-dp__days-head">
            {DIAS.map(d => <span key={d} className="adm-dp__dow">{d}</span>)}
          </div>
          <div className="adm-dp__grid">
            {cells.map((day, i) => {
              if (!day) return <span key={`e${i}`} />
              const isToday = today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === day
              const isSel   = selectedDay === day
              return (
                <button
                  key={day}
                  type="button"
                  className={`adm-dp__day ${isSel ? 'adm-dp__day--sel' : ''} ${isToday && !isSel ? 'adm-dp__day--today' : ''}`}
                  onClick={() => selectDay(day)}
                >{day}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Custom TimePicker ─────────────────────────────────────
const HOURS_12 = [12,1,2,3,4,5,6,7,8,9,10,11]
const MINS_60  = Array.from({length:60},(_,i)=>i)
const CELL_PX  = 36

function TimePicker({ value, onChange, placeholder = 'Hora', variant = 'pill' }) {
  const [open, setOpen] = useState(false)
  const ref   = useRef(null)
  const hRef  = useRef(null)
  const mRef  = useRef(null)

  const parsed = (() => {
    if (!value) return { h12: null, min: null, ampm: 'am' }
    const [hStr, mStr] = value.split(':')
    const h24 = parseInt(hStr, 10)
    return { h12: h24 % 12 || 12, min: parseInt(mStr, 10), ampm: h24 >= 12 ? 'pm' : 'am' }
  })()

  const selH = parsed.h12, selMin = parsed.min, selAP = parsed.ampm

  function emit(h12, min, ampm) {
    const h24 = ampm === 'pm' ? (h12 % 12) + 12 : h12 % 12
    onChange(`${String(h24).padStart(2,'0')}:${String(min).padStart(2,'0')}`)
  }
  function pickHour(h)  { emit(h, selMin ?? 0, selAP) }
  function pickMin(m)   { emit(selH ?? 12, m, selAP) }
  function pickAP(ap)   { emit(selH ?? 12, selMin ?? 0, ap); setOpen(false) }

  useEffect(() => {
    if (!open) return
    if (hRef.current && selH !== null) {
      const idx = HOURS_12.indexOf(selH)
      if (idx >= 0) hRef.current.scrollTop = Math.max(0, idx * CELL_PX - CELL_PX)
    }
    if (mRef.current && selMin !== null) {
      mRef.current.scrollTop = Math.max(0, selMin * CELL_PX - CELL_PX)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const displayVal = value ? (() => {
    const [hStr, mStr] = value.split(':')
    const h24 = parseInt(hStr, 10)
    return `${h24 % 12 || 12}:${mStr} ${h24 >= 12 ? 'p.m.' : 'a.m.'}`
  })() : ''

  const isInput = variant === 'input'

  return (
    <div className="adm-tp" ref={ref}>
      <button type="button"
        className={isInput
          ? `adm-tp__trigger-input ${value ? 'adm-tp__trigger-input--set' : ''}`
          : `adm-dp__trigger ${value ? 'adm-dp__trigger--set' : ''}`}
        onClick={() => setOpen(o => !o)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>{displayVal || placeholder}</span>
        {value && <span className="adm-dp__clear" onClick={e => { e.stopPropagation(); onChange('') }}>✕</span>}
      </button>
      {open && (
        <div className="adm-tp__drop">
          <div className="adm-tp__head-row">
            <span>Hora</span>
            <span>Min</span>
            <span></span>
          </div>
          <div className="adm-tp__body">
            <div className="adm-tp__col" ref={hRef}>
              {HOURS_12.map(h => (
                <button key={h} type="button"
                  className={`adm-tp__cell ${selH === h ? 'adm-tp__cell--sel' : ''}`}
                  onClick={() => pickHour(h)}>
                  {String(h).padStart(2,'0')}
                </button>
              ))}
            </div>
            <div className="adm-tp__sep">:</div>
            <div className="adm-tp__col" ref={mRef}>
              {MINS_60.map(m => (
                <button key={m} type="button"
                  className={`adm-tp__cell ${selMin === m ? 'adm-tp__cell--sel' : ''}`}
                  onClick={() => pickMin(m)}>
                  {String(m).padStart(2,'0')}
                </button>
              ))}
            </div>
            <div className="adm-tp__col adm-tp__col--ap">
              {['am','pm'].map(ap => (
                <button key={ap} type="button"
                  className={`adm-tp__cell adm-tp__cell--ap ${selAP === ap ? 'adm-tp__cell--sel' : ''}`}
                  onClick={() => pickAP(ap)}>
                  {ap === 'am' ? 'a.m.' : 'p.m.'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard({ onClose }) {
  const [currentUser, setCurrentUser] = useState(() => sessionStorage.getItem('adm_user') || null)
  const [userRole, setUserRole]       = useState(() => sessionStorage.getItem('adm_role') || 'admin')
  const [userPerms, setUserPerms]     = useState(() => { try { return JSON.parse(sessionStorage.getItem('adm_perms') || 'null') } catch { return null } })
  const [fallback, setFallback]       = useState(false)
  const authed = !!currentUser
  const isAdmin = userRole === 'admin'
  const canSee = (key) => {
    if (isAdmin) return true
    if (key === 'users') return false
    return userPerms?.[key] === true
  }

  const [period, setPeriod]   = useState(PERIODS[2])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [time, setTime]       = useState(clock())
  const [tab, setTab]         = useState('stats')
  const [insDateFrom, setInsDateFrom] = useState('')
  const [insDateTo,   setInsDateTo]   = useState('')

  const load = useCallback(async (days) => {
    setLoading(true)
    const data = await getStats(days)
    setStats(data)
    setLoading(false)
  }, [])

  useEffect(() => { if (authed) load(period.days) }, [authed, period, load])
  useEffect(() => { const t = setInterval(() => setTime(clock()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (!authed) return
    const t = setInterval(() => load(period.days), 30000)
    return () => clearInterval(t)
  }, [authed, period, load])

  const login = (username, isFallback, role = 'admin', permissions = null) => {
    sessionStorage.setItem('adm_user', username)
    sessionStorage.setItem('adm_role', role)
    sessionStorage.setItem('adm_perms', JSON.stringify(permissions))
    setCurrentUser(username)
    setFallback(isFallback)
    setUserRole(role)
    setUserPerms(permissions)
    if (role !== 'admin' && permissions) {
      const first = PERMS_CONFIG.find(p => permissions[p.key])
      setTab(first?.key ?? 'stats')
    }
  }
  const logout = () => {
    sessionStorage.removeItem('adm_user')
    sessionStorage.removeItem('adm_role')
    sessionStorage.removeItem('adm_perms')
    setCurrentUser(null)
    setUserRole('admin')
    setUserPerms(null)
    setStats(null)
    onClose()
  }

  const handleClear = async () => {
    if (!confirm('¿Borrar todos los eventos? Esta acción no se puede deshacer.')) return
    await clearEvents()
    load(period.days)
  }

  // Acumulado
  const aMsg   = cnt(stats?.byType, 'bot_message')
  const aWA    = cnt(stats?.byType, 'whatsapp_click')
  const aRes   = cnt(stats?.byType, 'reserva_click')
  const aConf  = cnt(stats?.byType, 'reserva_confirmada')

  // Hoy
  const tMsg   = cnt(stats?.todayByType, 'bot_message')
  const tWA    = cnt(stats?.todayByType, 'whatsapp_click')
  const tRes   = cnt(stats?.todayByType, 'reserva_click')
  const tConf  = cnt(stats?.todayByType, 'reserva_confirmada')

  // Ayer (delta)
  const yMsg   = cnt(stats?.yesterdayByType, 'bot_message')
  const yWA    = cnt(stats?.yesterdayByType, 'whatsapp_click')
  const yRes   = cnt(stats?.yesterdayByType, 'reserva_click')
  const yConf  = cnt(stats?.yesterdayByType, 'reserva_confirmada')

  const chartData = buildChartData(stats?.byDayType)

  return (
    <div className="adm-overlay">
      {!authed ? (
        <LoginScreen onLogin={login} />
      ) : (
        <div className="adm-dash">

          {/* Header */}
          <div className="adm-dash__header">
            <div className="adm-dash__hl">
              <div className="adm-dash__logo-box">
                <img src="/logo/logoNegro.svg" alt="logo" className="adm-dash__logo"/>
              </div>
              <div>
                <div className="adm-dash__name">
                  Hotel Punta Galería
                  <span className={`adm-dash__badge${isAdmin ? '' : ' adm-dash__badge--editor'}`}>{isAdmin ? 'Admin' : 'Editor'}</span>
                </div>
                <div className="adm-dash__live">
                  <span className="adm-live-dot"/>
                  Live · {time} · {period.label} · <strong>{currentUser}</strong>
                </div>
              </div>
            </div>
            <div className="adm-dash__hr">
              <button className="adm-hbtn" onClick={() => load(period.days)} disabled={loading} title="Actualizar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>
              <button className="adm-hbtn" onClick={handleClear} title="Limpiar datos">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
              <button className="adm-hbtn adm-hbtn--primary" onClick={logout} title="Salir">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>

          {/* Tab + period bar */}
          <div className="adm-period-bar">
            {canSee('stats') && <button className={`adm-period-btn adm-tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Estadísticas</button>}
            {canSee('google') && <button className={`adm-period-btn adm-tab-btn ${tab === 'google' ? 'active' : ''}`} onClick={() => setTab('google')}>Google</button>}
            {canSee('actividades') && <button className={`adm-period-btn adm-tab-btn ${tab === 'actividades' ? 'active' : ''}`} onClick={() => setTab('actividades')}>Actividades</button>}
            {canSee('eventos') && <button className={`adm-period-btn adm-tab-btn ${tab === 'eventos' ? 'active' : ''}`} onClick={() => setTab('eventos')}>Eventos</button>}
            {canSee('inscripciones') && <button className={`adm-period-btn adm-tab-btn ${tab === 'inscripciones' ? 'active' : ''}`} onClick={() => setTab('inscripciones')}>Inscripciones</button>}
            {isAdmin && <button className={`adm-period-btn adm-tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Usuarios</button>}
            <span className="adm-period-sep"/>
            {tab === 'stats' && PERIODS.map(p => (
              <button key={p.label} className={`adm-period-btn ${period.label === p.label ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p.label}
              </button>
            ))}
            {tab === 'inscripciones' && (
              <div className="adm-bar-daterange">
                <span className="adm-bar-daterange__label">Período</span>
                <DatePicker value={insDateFrom} onChange={setInsDateFrom} placeholder="Desde" />
                <span className="adm-bar-datesep">→</span>
                <DatePicker value={insDateTo} onChange={setInsDateTo} placeholder="Hasta" />
              </div>
            )}
          </div>

          {/* Fallback warning */}
          {fallback && (
            <div className="adm-fallback-warn">
              ⚠️ Estás usando la contraseña de emergencia (.env). Crea un usuario en la pestaña <strong>Usuarios</strong> para mayor seguridad.
            </div>
          )}

          {/* Body */}
          <div className="adm-dash__body">
            {tab === 'users' ? (
              <UsersSection currentUser={currentUser} />
            ) : tab === 'actividades' ? (
              <ActivitiesSection />
            ) : tab === 'eventos' ? (
              <EventosSection />
            ) : tab === 'inscripciones' ? (
              <ActivityRegistrationsSection dateFrom={insDateFrom} dateTo={insDateTo} />
            ) : tab === 'google' ? (
              <SearchConsoleTab />
            ) : loading && !stats ? (
              <p className="adm-loading">Cargando estadísticas…</p>
            ) : (
              <>
                {/* Acumulado */}
                <div className="adm-section-lbl">ACUMULADO · {period.label}</div>
                <div className="adm-grid5">
                  <StatCard label="SESIONES"    value={stats?.sessions} sub="únicas"            Icon={IcoUsers} />
                  <StatCard label="MENSAJES"    value={aMsg}            sub="enviados al bot"   Icon={IcoMsg}   />
                  <StatCard label="WHATSAPP"    value={aWA}             sub="clicks totales"    Icon={IcoWA}    />
                  <StatCard label="INTENTOS"    value={aRes}            sub="modal de reserva"  Icon={IcoCal}   />
                  <StatCard label="CONFIRMADAS" value={aConf}           sub="enviaron a WA"     Icon={IcoCheck} />
                </div>

                {/* Hoy */}
                <div className="adm-section-lbl">HOY · {todayLabel()}</div>
                <div className="adm-grid5">
                  <StatCard label="SESIONES"    value={null}   sub="hoy" Icon={IcoUsers} />
                  <StatCard label="MENSAJES"    value={tMsg}   sub="hoy" Icon={IcoMsg}   delta={diff(tMsg,  yMsg)}  />
                  <StatCard label="WHATSAPP"    value={tWA}    sub="hoy" Icon={IcoWA}    delta={diff(tWA,   yWA)}   />
                  <StatCard label="INTENTOS"    value={tRes}   sub="hoy" Icon={IcoCal}   delta={diff(tRes,  yRes)}  />
                  <StatCard label="CONFIRMADAS" value={tConf}  sub="hoy" Icon={IcoCheck} delta={diff(tConf, yConf)} />
                </div>

                {/* Conversiones */}
                <div className="adm-section-lbl">CONVERSIONES · {period.label}</div>
                <div className="adm-conv-row adm-conv-row--3">
                  <div className="adm-conv-panel">
                    <p className="adm-conv-title">
                      <IcoWA /> WhatsApp por sección
                    </p>
                    <ConversionList data={stats?.waSources} labels={WA_LABELS} color="#25d366" />
                  </div>
                  <div className="adm-conv-panel">
                    <p className="adm-conv-title">
                      <IcoCal /> Intentos de reserva
                    </p>
                    <ConversionList data={stats?.reservaSources} labels={RESERVA_LABELS} color="#7a8c2e" />
                  </div>
                  <div className="adm-conv-panel">
                    <p className="adm-conv-title">
                      <IcoCheck /> Reservas confirmadas
                    </p>
                    <ConversionList data={stats?.confirmaSources} labels={RESERVA_LABELS} color="#b5c840" />
                  </div>
                </div>

                {/* Charts */}
                <div className="adm-charts-row">
                  <div className="adm-chart-panel">
                    <p className="adm-chart-panel__title">Distribución de tipos</p>
                    <Distribution byType={stats?.byType} />
                  </div>
                  <div className="adm-chart-panel adm-chart-panel--wide">
                    <p className="adm-chart-panel__title">Actividad — últimos 14 días</p>
                    <LineChart data={chartData} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────
function IcoUsers() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IcoMsg() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function IcoWA() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
}
function IcoGrid() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function IcoCal() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IcoCheck() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
