import { useState, useEffect, useCallback } from 'react'
import {
  getStats, clearEvents,
  adminLogin, adminHasUsers, adminCreateUser, adminGetUsers, adminDeleteUser, adminChangePassword,
  getActivities, saveActivity, deleteActivity, updateActivity,
  getEvents, createEvent, updateEvent, deleteEvent, getRegistrationsByEvent,
  getAllActivityRegistrations, getEventByActivityId,
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
              </span>
              <span className="adm-user-row__date">
                {String(u.created_at ?? '').slice(0, 10)}
              </span>
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

// ── Activities section ────────────────────────────────────
function ActivitiesSection() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [name, setName]             = useState('')
  const [fechaTipo, setFechaTipo]   = useState('fecha')
  const [fecha, setFecha]           = useState('')
  const [diaRec, setDiaRec]         = useState('Viernes')
  const [frecRec, setFrecRec]       = useState('todas')
  const [hora, setHora]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setActivities(await getActivities())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (a) => {
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(a.fecha ?? '')
    const tipo = isDate || !a.fecha ? 'fecha' : 'rec'
    const { diaRec: dr, frecRec: fr } = recoverRec(a)
    setEditItem({ id: a.id, name: a.name, tipo, fecha: isDate ? (a.fecha ?? '') : '', diaRec: dr, frecRec: fr, hora: a.hora ?? '' })
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
      setEditItem(null); load()
    } catch { setErr('Error al guardar') }
    finally { setSaving(false) }
  }

  const add = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setErr('Escribe el nombre de la actividad'); return }
    const fechaValue = fechaTipo === 'fecha' ? fecha : buildFecha(diaRec, frecRec)
    const semanasValue = fechaTipo === 'rec' ? frecRec : 'todas'
    setSaving(true); setErr('')
    try {
      await saveActivity(name.trim(), fechaValue, hora, semanasValue)
      setName(''); setFecha(''); setHora(''); load()
    } catch { setErr('Error al guardar') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('¿Eliminar esta actividad?')) return
    await deleteActivity(id); load()
  }

  const set = (k) => (e) => setEditItem(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="adm-activities">
      <div className="adm-users__header">
        <span>Actividades en el hotel</span>
        <span className="adm-users__count">{activities.length} activa{activities.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-users__list">
          {activities.length === 0 && (
            <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin actividades. Agrega la primera abajo.</p>
          )}
          {activities.map(a => (
            <div key={a.id} className={`adm-act-row ${editItem?.id === a.id ? 'adm-act-row--editing' : ''}`}>
              <span className="adm-act-row__icon">{getActivityIcon(a.name)}</span>
              <div className="adm-act-row__info">
                <span className="adm-act-row__name">
                  {a.name}
                  {a.semanas && a.semanas !== 'todas' && (
                    <span className="adm-act-badge">{FREC_LABEL[a.semanas]?.trim()}</span>
                  )}
                </span>
                {(a.fecha || a.hora) && (
                  <span className="adm-act-row__when">
                    {fmtFecha(a.fecha)}{a.hora ? ' · ' + fmtHora(a.hora) : ''}
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
          ))}
        </div>
      )}

      {/* Inline edit form */}
      {editItem && (
        <form onSubmit={saveEdit} className="adm-act-edit">
          <div className="adm-act-edit__head">
            <span className="adm-act-form__preview">{getActivityIcon(editItem.name)}</span>
            <span className="adm-users__change-title">Editando actividad</span>
          </div>
          <input type="text" value={editItem.name} onChange={set('name')} placeholder="Nombre" className="adm-users__input adm-act-form__name" autoFocus />
          <div className="adm-act-tipo">
            <button type="button" className={editItem.tipo === 'fecha' ? 'active' : ''} onClick={() => setEditItem(p => ({...p, tipo: 'fecha'}))}>Fecha</button>
            <button type="button" className={editItem.tipo === 'rec'   ? 'active' : ''} onClick={() => setEditItem(p => ({...p, tipo: 'rec'}))}>Recurrente</button>
          </div>
          {editItem.tipo === 'fecha' ? (
            <input type="date" value={editItem.fecha} onChange={set('fecha')} className="adm-users__input adm-act-form__field" />
          ) : (
            <div className="adm-act-rec-wrap">
              <select value={editItem.diaRec} onChange={set('diaRec')} className="adm-users__input">
                {DIAS_REC.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={editItem.frecRec} onChange={set('frecRec')} className="adm-users__input">
                {FREC_REC.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
              </select>
            </div>
          )}
          <input type="time" value={editItem.hora} onChange={set('hora')} className="adm-users__input adm-act-form__field" />
          <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving}>{saving ? '…' : 'Guardar'}</button>
          <button type="button" className="adm-btn-sm" onClick={() => setEditItem(null)}>Cancelar</button>
        </form>
      )}

      {/* Add form */}
      <form onSubmit={add} className="adm-act-form">
        <span className="adm-act-form__preview">{getActivityIcon(name)}</span>
        <input type="text" value={name} onChange={e => { setName(e.target.value); setErr('') }} placeholder="Nombre (ej: Yoga, Pilates, Zumba…)" className="adm-users__input adm-act-form__name" />
        <div className="adm-act-tipo">
          <button type="button" className={fechaTipo === 'fecha' ? 'active' : ''} onClick={() => setFechaTipo('fecha')}>Fecha</button>
          <button type="button" className={fechaTipo === 'rec'   ? 'active' : ''} onClick={() => setFechaTipo('rec')}>Recurrente</button>
        </div>
        {fechaTipo === 'fecha' ? (
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="adm-users__input adm-act-form__field" />
        ) : (
          <div className="adm-act-rec-wrap">
            <select value={diaRec} onChange={e => setDiaRec(e.target.value)} className="adm-users__input">
              {DIAS_REC.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={frecRec} onChange={e => setFrecRec(e.target.value)} className="adm-users__input">
              {FREC_REC.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
            </select>
          </div>
        )}
        <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="adm-users__input adm-act-form__field" />
        <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving}>{saving ? '…' : '+ Agregar'}</button>
      </form>
      {err && <p className="adm-users__err">{err}</p>}
    </div>
  )
}

// ── Activity Registrations view ──────────────────────────
function ActivityRegistrationsSection() {
  const [regs, setRegs]     = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    getAllActivityRegistrations().then(d => { setRegs(d); setLoading(false) })
  }, [])

  const names = [...new Set(regs.map(r => r.activity_name).filter(Boolean))]
  const filtered = filter ? regs.filter(r => r.activity_name === filter) : regs

  return (
    <div className="adm-activities">
      <div className="adm-users__header">
        <span>Inscripciones a actividades</span>
        <span className="adm-users__count">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      {names.length > 1 && (
        <div className="adm-act-tipo" style={{ padding: '0 16px 4px' }}>
          <button type="button" className={!filter ? 'active' : ''} onClick={() => setFilter('')}>Todas</button>
          {names.map(n => (
            <button key={n} type="button" className={filter === n ? 'active' : ''} onClick={() => setFilter(n)}>{n}</button>
          ))}
        </div>
      )}
      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-registrations-table">
          {filtered.length === 0 ? (
            <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin inscripciones aún</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>¿Cómo se enteró?</th>
                  <th>WhatsApp</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.activity_name}</strong></td>
                    <td>{r.full_name}</td>
                    <td>{r.phone}</td>
                    <td>{r.how_found}</td>
                    <td>{r.whatsapp}</td>
                    <td className="adm-table__date">{new Date(r.created_at).toLocaleDateString('es-MX')}</td>
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
      let ok = false
      let fallback = false
      if (!hasUsers) {
        ok = pwd === FALLBACK_PWD
        fallback = ok
      } else {
        ok = await adminLogin(user.trim(), pwd)
      }
      if (ok) onLogin(user.trim(), fallback)
      else { setErr('Usuario o contraseña incorrectos'); setPwd('') }
    } catch { setErr('Error de conexión') }
    finally { setBusy(false) }
  }

  return (
    <div className="adm-login">
      <div className="adm-login__accent"/>
      <div className="adm-login__logo-wrap">
        <img src="/logo/logo.svg" alt="Hotel Punta Galería" className="adm-login__logo"/>
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
  const [newEventForm, setNewEventForm] = useState({ name: '', slug: '', price: '', date: '', description: '', capacity: '', activity_id: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

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
    setRegistrations(await getRegistrationsByEvent(event.id))
    setRegLoading(false)
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
      setNewEventForm({ name: '', slug: '', price: '', date: '', description: '', capacity: '', activity_id: '' }); load()
    } catch (e) { setErr('Error al guardar: ' + e.message) }
    finally { setSaving(false) }
  }

  const delEvent = async (id) => {
    if (!confirm('¿Eliminar este evento?')) return
    await deleteEvent(id); load()
  }

  const copyLink = (slug) => {
    const link = `${window.location.origin}/evento/${slug}`
    navigator.clipboard.writeText(link)
    alert('Link copiado: ' + link)
  }

  const set = (k) => (e) => setEditItem(p => ({ ...p, [k]: e.target.value }))
  const setNew = (k) => (e) => {
    const val = e.target.value
    setNewEventForm(p => ({ ...p, [k]: val, ...(k === 'name' && !p.slug ? { slug: toSlug(val) } : {}) }))
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
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Notas</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={r.id}>
                      <td>{r.full_name}</td>
                      <td>{r.email}</td>
                      <td>{r.phone}</td>
                      <td>{r.notes}</td>
                      <td className="adm-table__date">{new Date(r.created_at).toLocaleDateString()}</td>
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

  return (
    <div className="adm-eventos">
      <div className="adm-users__header">
        <span>Eventos</span>
        <span className="adm-users__count">{events.length} evento{events.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-users__list">
          {events.length === 0 && (
            <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin eventos. Agrega el primero abajo.</p>
          )}
          {events.map(e => (
            <div key={e.id} className={`adm-evt-row ${editItem?.id === e.id ? 'adm-evt-row--editing' : ''}`}>
              <div className="adm-evt-row__info">
                <span className="adm-evt-row__name">{e.name}</span>
                {e.date && <span className="adm-evt-row__when">{e.date}</span>}
                {e.price && <span className="adm-evt-row__price">${e.price.toFixed(2)}</span>}
              </div>
              <button className="adm-user-row__btn" onClick={() => copyLink(e.slug)} title="Copiar link">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </button>
              <button className="adm-user-row__btn" onClick={() => viewRegistrations(e)} title="Ver inscritos">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </button>
              <button className="adm-user-row__btn" onClick={() => startEdit(e)} title="Editar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => delEvent(e.id)} title="Eliminar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline edit form */}
      {editItem && (
        <form onSubmit={saveEdit} className="adm-evt-edit">
          <span className="adm-users__change-title">Editando evento</span>
          <input type="text" value={editItem.name} onChange={set('name')} placeholder="Nombre" className="adm-users__input" autoFocus />
          <input type="text" value={editItem.slug} onChange={set('slug')} placeholder="Slug (URL)" className="adm-users__input" />
          <input type="number" step="0.01" value={editItem.price} onChange={set('price')} placeholder="Precio ($)" className="adm-users__input" />
          <input type="date" value={editItem.date} onChange={set('date')} className="adm-users__input" />
          <input type="text" value={editItem.description} onChange={set('description')} placeholder="Descripción" className="adm-users__input" />
          <input type="number" value={editItem.capacity} onChange={set('capacity')} placeholder="Capacidad (personas)" className="adm-users__input" />
          <select value={editItem.activity_id ?? ''} onChange={set('activity_id')} className="adm-users__input">
            <option value="">— Sin vincular a actividad —</option>
            {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving}>{saving ? '…' : 'Guardar'}</button>
          <button type="button" className="adm-btn-sm" onClick={() => setEditItem(null)}>Cancelar</button>
          {err && <p className="adm-err-msg">{err}</p>}
        </form>
      )}

      {/* New event form */}
      <form onSubmit={addEvent} className="adm-evt-add">
        <span className="adm-users__change-title">Nuevo evento / clase</span>
        <input type="text" value={newEventForm.name} onChange={setNew('name')} placeholder="Nombre (ej: Yoga Mayo)" className="adm-users__input" />
        <input type="text" value={newEventForm.slug} onChange={setNew('slug')} placeholder="Slug (URL)" className="adm-users__input" />
        <input type="number" step="0.01" value={newEventForm.price} onChange={setNew('price')} placeholder="Precio ($)" className="adm-users__input" />
        <input type="date" value={newEventForm.date} onChange={setNew('date')} className="adm-users__input" />
        <input type="text" value={newEventForm.description} onChange={setNew('description')} placeholder="Descripción del evento" className="adm-users__input" />
        <input type="number" value={newEventForm.capacity} onChange={setNew('capacity')} placeholder="Capacidad (personas)" className="adm-users__input" />
        <select value={newEventForm.activity_id} onChange={setNew('activity_id')} className="adm-users__input">
          <option value="">— Vincular a actividad (opcional) —</option>
          {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving}>{saving ? '…' : 'Crear evento'}</button>
        {err && <p className="adm-err-msg">{err}</p>}
      </form>
    </div>
  )
}

export default function AdminDashboard({ onClose }) {
  const [currentUser, setCurrentUser] = useState(() => sessionStorage.getItem('adm_user') || null)
  const [fallback, setFallback]       = useState(false)
  const authed = !!currentUser

  const [period, setPeriod]   = useState(PERIODS[2])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [time, setTime]       = useState(clock())
  const [tab, setTab]         = useState('stats')

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

  const login = (username, isFallback) => {
    sessionStorage.setItem('adm_user', username)
    setCurrentUser(username)
    setFallback(isFallback)
  }
  const logout = () => {
    sessionStorage.removeItem('adm_user')
    setCurrentUser(null)
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
                <img src="/logo/logo.svg" alt="logo" className="adm-dash__logo"/>
              </div>
              <div>
                <div className="adm-dash__name">
                  Hotel Punta Galería
                  <span className="adm-dash__badge">Admin</span>
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
            <button className={`adm-period-btn adm-tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
              Estadísticas
            </button>
            <button className={`adm-period-btn adm-tab-btn ${tab === 'google' ? 'active' : ''}`} onClick={() => setTab('google')}>
              Google
            </button>
            <button className={`adm-period-btn adm-tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
              Usuarios
            </button>
            <button className={`adm-period-btn adm-tab-btn ${tab === 'actividades' ? 'active' : ''}`} onClick={() => setTab('actividades')}>
              Actividades
            </button>
            <button className={`adm-period-btn adm-tab-btn ${tab === 'eventos' ? 'active' : ''}`} onClick={() => setTab('eventos')}>
              Eventos
            </button>
            <button className={`adm-period-btn adm-tab-btn ${tab === 'inscripciones' ? 'active' : ''}`} onClick={() => setTab('inscripciones')}>
              Inscripciones
            </button>
            <span className="adm-period-sep"/>
            {tab === 'stats' && PERIODS.map(p => (
              <button key={p.label} className={`adm-period-btn ${period.label === p.label ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p.label}
              </button>
            ))}
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
              <ActivityRegistrationsSection />
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
