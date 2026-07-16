import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getEvents, getArchivedEvents, getActivityRegistrationsByEvent, getAllActivityRegistrations, saveActivity, upsertActivityEvent, updateActivity, deleteEvent, closeEvent, deleteActivity, updateActivityRegistrationPayment, checkInRegistration, resetAllEventsAndAttendees, adminGetUsers, adminCreateUser, adminChangePassword, genGenericPassword, getRegistrationsByPhone, API_BASE } from '../lib/turso'
import { DatePicker, TimePicker } from './common/DateTimePickers'
import { getActivityIcon } from '../lib/activityIcons'
import { checkPasswordStrength } from '../lib/passwordStrength'
import { subscribeToPush } from '../lib/pushNotifications'
import './StaffApp.css'

const FILTERS = { all: 'Todos', paid: 'Pagados', pending: 'Pendientes', attended: 'Asistieron' }
const DESC_MAX = 200

const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "2026-06-09" → "mar 9 jun"
function fmtEventDate(dateStr) {
  if (!dateStr) return 'Sin fecha'
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  return `${DIAS_SEM[d.getDay()]} ${d.getDate()} ${MESES_ABR[d.getMonth()]}`
}

// Etiqueta de recencia para historial: "Cerró hoy", "hace N días"...
function closedRelative(dateStr) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return ''
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - d) / 86400000)
  if (diff < 0) return 'Próximo'
  if (diff === 0) return 'Cerró hoy'
  if (diff === 1) return 'Cerró ayer'
  if (diff < 7) return `Cerró hace ${diff} días`
  if (diff < 14) return 'Cerró hace 1 semana'
  if (diff < 30) return `Cerró hace ${Math.floor(diff / 7)} semanas`
  if (diff < 60) return 'Cerró hace 1 mes'
  return `Cerró hace ${Math.floor(diff / 30)} meses`
}

// Etiqueta de recencia fina para historial de actividad (checkin/pago): "hace 5 min", "hace 2h"...
function timeAgoShort(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return ''
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `hace ${diffH}h`
  const diffD = Math.round(diffH / 24)
  return `hace ${diffD}d`
}

// ── Alert utilities (fuera del componente para estabilidad) ──
function playAlertSound(type = 'reg') {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const beep = (freq, start, dur, vol = 0.35) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'; o.frequency.value = freq
      g.gain.setValueAtTime(vol, start)
      g.gain.exponentialRampToValueAtTime(0.001, start + dur)
      o.start(start); o.stop(start + dur)
    }
    if (type === 'payment') {
      beep(523, ctx.currentTime, 0.12)
      beep(659, ctx.currentTime + 0.13, 0.12)
      beep(880, ctx.currentTime + 0.27, 0.20)
    } else {
      beep(880, ctx.currentTime, 0.14)
      beep(1100, ctx.currentTime + 0.19, 0.14)
    }
  } catch {}
}

function vibrateDevice(pattern) {
  try { navigator.vibrate?.(pattern) } catch {}
}

function triggerAlert(type = 'reg') {
  vibrateDevice(type === 'payment' ? [100, 60, 100, 60, 200] : [180, 80, 180])
  playAlertSound(type)
}

function showSystemNotification(title, body) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      icon: '/logo/logNegro.svg',
      tag: 'hotel-staff',
      renotify: true,
    })
  } catch {}
}

function syncPaidWatermark(regs) {
  if (!regs || regs.length === 0) return
  const paidCount = regs.filter(r => r.paid === 1 || r.paid === '1').length
  localStorage.setItem('notif_paid_count', String(paidCount))
}

function checkStateChanges(regs) {
  if (!regs || regs.length === 0) return { newRegs: [], newPayments: 0 }
  const maxId = regs.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0)
  const paidCount = regs.filter(r => r.paid === 1 || r.paid === '1').length
  const lastId = parseInt(localStorage.getItem('notif_last_id') || '0', 10)
  const lastPaid = parseInt(localStorage.getItem('notif_paid_count') || '-1', 10)

  // Primera vez — solo establece marcadores, sin notificaciones
  if (lastId === 0 || lastPaid === -1) {
    localStorage.setItem('notif_last_id', String(maxId))
    localStorage.setItem('notif_paid_count', String(paidCount))
    return { newRegs: [], newPayments: 0 }
  }

  const newRegs = maxId > lastId ? regs.filter(r => Number(r.id) > lastId) : []
  const newPayments = paidCount > lastPaid ? paidCount - lastPaid : 0

  if (newRegs.length > 0) localStorage.setItem('notif_last_id', String(maxId))
  if (newPayments > 0) localStorage.setItem('notif_paid_count', String(paidCount))

  return { newRegs, newPayments }
}

export default function StaffApp({ onStartScan, onLogout }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role] = useState(() => localStorage.getItem('ci_role') || 'staff')

  const [view, setView] = useState('dashboard')
  const [copiedId, setCopiedId] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [events, setEvents] = useState([])
  const [archivedEvents, setArchivedEvents] = useState([])
  const [allRegs, setAllRegs] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showSplash, setShowSplash] = useState(true)
  const [showEventPicker, setShowEventPicker] = useState(false)
  const [showFilterPicker, setShowFilterPicker] = useState(false)
  const [showEditionPicker, setShowEditionPicker] = useState(null) // archived event or null

  // ── Modal & Toast ──
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // Refs para que el intervalo de polling acceda al estado actual sin stale closure
  const selectedEventRef = useRef(null)
  const viewRef = useRef('dashboard')

  // ── Notifications ──
  const [notifCount, setNotifCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [pushDiag, setPushDiag] = useState(null)
  // Cada ítem: { type:'reg'|'payment', id, full_name?, phone?, payment_method?, count? }

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  // ── Create Event State ──
  const [newEvt, setNewEvt] = useState({ name: '', date: '', time: '', price: '', capacity: '', description: '' })
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [createdSlug, setCreatedSlug] = useState(null)
  const [autoClose, setAutoClose] = useState(null)

  const goHome = useCallback(() => {
    setCreatedSlug(null)
    setAutoClose(null)
    setView('dashboard')
  }, [])

  // Inicia cuenta regresiva al mostrar la pantalla de exito
  useEffect(() => {
    setAutoClose(createdSlug ? 8 : null)
  }, [createdSlug])

  // Tick cada segundo (pausado si autoClose es null)
  useEffect(() => {
    if (autoClose === null || autoClose <= 0) return
    const id = setTimeout(() => setAutoClose(s => (s === null ? null : s - 1)), 1000)
    return () => clearTimeout(id)
  }, [autoClose])

  // Al llegar a 0, vuelve al inicio
  useEffect(() => {
    if (autoClose === 0) goHome()
  }, [autoClose, goHome])

  // ── Menu (bottom sheet) + OTA manual ──
  const [showMenu, setShowMenu] = useState(false)
  const [localVer, setLocalVer] = useState(null)        // { version, label }
  const [latestVer, setLatestVer] = useState(undefined) // undefined=sin checar, null=error, obj=ok
  const [showVersions, setShowVersions] = useState(false)
  const onRemoteBuild = typeof location !== 'undefined' && location.hostname.includes('hotelpuntagaleria')

  const fetchVer = useCallback(async (url) => {
    try {
      const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' })
      if (!r.ok) return null
      return await r.json()
    } catch { return null }
  }, [])

  // Version que corre ahora mismo (la del origen cargado)
  useEffect(() => {
    fetchVer('/version.json').then(v => v && setLocalVer(v)).catch(() => {})
  }, [fetchVer])

  // Auto-check version al montar — sin esperar a que el user abra el menu
  useEffect(() => {
    const check = async () => {
      const remote = await fetchVer('https://hotelpuntagaleria.mx/version.json')
      setLatestVer(remote || null)
    }
    const t = setTimeout(check, 3000) // 3s despues del login para no bloquear carga
    return () => clearTimeout(t)
  }, [fetchVer])

  const [updateDismissed, setUpdateDismissed] = useState(() => {
    try { return localStorage.getItem('update_dismissed') || '' } catch { return '' }
  })

  // Carga la version desplegada (cache-bust para ver los cambios al instante)
  const loadOnline = useCallback(() => {
    window.location.href = `https://hotelpuntagaleria.mx/checkin?v=${Date.now()}`
  }, [])

  const backToInstalled = useCallback(() => {
    try { localStorage.removeItem('ota_mode') } catch {}
    if (window.history.length > 1) window.history.back()
    else window.location.href = 'http://localhost/'
  }, [])

  // Abre el panel de versiones y consulta la ultima publicada
  const openVersions = useCallback(async () => {
    setShowMenu(false)
    setLatestVer(undefined)
    setShowVersions(true)
    const remote = await fetchVer('https://hotelpuntagaleria.mx/version.json')
    setLatestVer(remote || null)
  }, [fetchVer])

  const appVersion = localVer?.label || ''
  const updateAvailable = latestVer && localVer && latestVer.version !== localVer.version

  // ── Panel admin movil ──
  const [adminUsers, setAdminUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [pwTarget, setPwTarget] = useState(null)   // username en edicion
  const [pwValue, setPwValue] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwGeneric, setPwGeneric] = useState(true) // forzar cambio al ingresar
  const [pwDone, setPwDone] = useState('')          // clave generica generada para enviar
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserPw, setNewUserPw] = useState('')
  const [newUserRole, setNewUserRole] = useState('staff')
  const [newUserMustChange, setNewUserMustChange] = useState(true)
  const [creatingUser, setCreatingUser] = useState(false)
  const [newUserErr, setNewUserErr] = useState('')
  const [newUserDone, setNewUserDone] = useState('')

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try { setAdminUsers(await adminGetUsers()) }
    catch { showToast('Error al cargar usuarios', 'error') }
    finally { setLoadingUsers(false) }
  }, [])

  useEffect(() => {
    if (view === 'admin') loadUsers()
  }, [view, loadUsers])

  const savePassword = useCallback(async (username) => {
    const chk = checkPasswordStrength(pwValue.trim())
    if (!chk.ok) { showToast(chk.message, 'error'); return }
    setPwSaving(true)
    try {
      await adminChangePassword(username, pwValue.trim(), pwGeneric)
      if (pwGeneric) {
        setPwDone(pwValue.trim())   // mostrar para enviar
        showToast(`Clave genérica lista para ${username}`)
      } else {
        showToast(`Contraseña de ${username} actualizada`)
        setPwTarget(null); setPwValue('')
      }
      loadUsers()
    } catch {
      showToast('No se pudo cambiar la contraseña', 'error')
    } finally {
      setPwSaving(false)
    }
  }, [pwValue, pwGeneric, loadUsers])

  const createNewUser = useCallback(async () => {
    const uname = newUserName.trim()
    if (!uname) { setNewUserErr('Ingresa un nombre de usuario'); return }
    if (/\s/.test(uname)) { setNewUserErr('El usuario no puede tener espacios'); return }
    const chk = checkPasswordStrength(newUserPw.trim())
    if (!chk.ok) { setNewUserErr(chk.message); return }
    setCreatingUser(true); setNewUserErr('')
    try {
      await adminCreateUser(uname, newUserPw.trim(), newUserRole, newUserMustChange)
      if (newUserMustChange) {
        setNewUserDone(newUserPw.trim())
      } else {
        showToast(`Usuario "${uname}" creado`)
        setShowNewUser(false); setNewUserName(''); setNewUserPw(''); setNewUserRole('staff'); setNewUserMustChange(true)
      }
      loadUsers()
    } catch (err) {
      setNewUserErr(err?.message?.includes('UNIQUE') ? 'Ese nombre de usuario ya existe' : 'Error al crear usuario')
    } finally {
      setCreatingUser(false)
    }
  }, [newUserName, newUserPw, newUserRole, newUserMustChange, loadUsers])

  // Reset total (solo admin): borra eventos + asistentes, doble confirmacion
  const handleResetAll = useCallback(() => {
    setShowMenu(false)
    setModal({
      icon: 'delete',
      title: 'Dejar la app como nueva',
      message: 'Se borrarán TODOS los eventos, actividades y asistentes (pagados y pendientes). No se puede deshacer.',
      confirmLabel: 'Continuar',
      danger: true,
      onConfirm: () => {
        setModal({
          icon: 'delete',
          title: '¿Estás seguro?',
          message: 'Última confirmación. Se eliminará todo el historial de eventos y asistentes de forma permanente.',
          confirmLabel: 'Borrar todo',
          danger: true,
          onConfirm: async () => {
            setModal(null)
            setLoading(true)
            try {
              await resetAllEventsAndAttendees()
              const [evs, archived, regs] = await Promise.all([getEvents(), getArchivedEvents(), getAllActivityRegistrations()])
              setEvents(evs); setArchivedEvents(archived); setAllRegs(regs)
              setSelectedEvent(null); setView('dashboard')
              showToast('App reiniciada. Todo borrado.')
            } catch (err) {
              console.error(err)
              showToast('Error al borrar. Intenta de nuevo.', 'error')
            } finally {
              setLoading(false)
            }
          },
        })
      },
    })
  }, [])

  const handleAiGenerate = async () => {
    if (!newEvt.name?.trim()) { showToast('Ingresa primero el nombre del evento', 'error'); return }
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
      showToast('Error al generar la descripción', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  const lowerRole = role?.toLowerCase()
  const canCreate = lowerRole === 'admin' || lowerRole === 'staff' || lowerRole === 'editor' || JSON.parse(localStorage.getItem('ci_perms') || 'null')?.eventos === true

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

  const handleNotifClick = () => {
    setShowNotifPanel(p => !p)
    if (notifCount > 0) setNotifCount(0)
  }

  const handleTestPush = async () => {
    setPushDiag('verificando…')
    try {
      const base = API_BASE || ''
      // 1) Diagnóstico del servidor
      const diagRes = await fetch(`${base}/.netlify/functions/push-notify`)
      const diag = await diagRes.json()
      const saOk = diag?.env?.FIREBASE_SERVICE_ACCOUNT
      const pidOk = diag?.env?.FIREBASE_PROJECT_ID
      const tokens = diag?.db?.fcmTokens ?? 0
      const authOk = diag?.fcmAuth === 'OK'
      if (!saOk || !pidOk) {
        setPushDiag(`❌ Falta en Netlify: ${!saOk ? 'FIREBASE_SERVICE_ACCOUNT ' : ''}${!pidOk ? 'FIREBASE_PROJECT_ID' : ''}`)
        return
      }
      if (!authOk) { setPushDiag(`❌ Auth FCM: ${diag.fcmAuth}`); return }
      if (tokens === 0) { setPushDiag('❌ No hay tokens FCM en la BD — abre la app y espera 10 s'); return }
      // 2) Enviar push de prueba
      const sendRes = await fetch(`${base}/.netlify/functions/push-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Prueba Hotel', body: 'Si ves esto fuera de la app, FCM funciona ✓', tag: 'test' }),
      })
      const send = await sendRes.json()
      setPushDiag(`✅ Enviado — tokens: ${tokens}, FCM ok: ${send.fcm}, errores: ${send.fcmErrors}`)
    } catch (e) {
      setPushDiag(`❌ Error: ${e.message}`)
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

  const handleDeleteEvent = (ev) => {
    setModal({
      icon: 'delete',
      title: 'Eliminar evento',
      message: `"${ev.name}" se eliminará permanentemente junto con todos sus datos.`,
      confirmLabel: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        setModal(null)
        setLoading(true)
        try {
          await deleteEvent(ev.id)
          if (ev.activity_id) await deleteActivity(ev.activity_id)
          const [evs, archived] = await Promise.all([getEvents(), getArchivedEvents()])
          setEvents(evs)
          setArchivedEvents(archived)
          showToast('Evento eliminado')
        } catch (err) {
          console.error(err)
          showToast('Error al eliminar el evento', 'error')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleCloseEvent = (ev, e) => {
    if (e) e.stopPropagation()
    setModal({
      icon: 'lock',
      title: 'Cerrar evento',
      message: `"${ev.name}" se moverá al historial. Desde ahí podrás crear una nueva edición para la siguiente semana.`,
      confirmLabel: 'Cerrar evento',
      danger: false,
      onConfirm: async () => {
        setModal(null)
        setLoading(true)
        try {
          await closeEvent(ev.id)
          const [evs, archived] = await Promise.all([getEvents(), getArchivedEvents()])
          setEvents(evs)
          setArchivedEvents(archived)
          showToast(`"${ev.name}" archivado`)
        } catch (err) {
          console.error(err)
          showToast('Error al cerrar el evento', 'error')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const calcNextWeekStr = (dateStr) => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    if (!dateStr) {
      const d = new Date(); d.setDate(d.getDate() + 7)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    }
    // Advance from the event's own date in 7-day steps until we pass today
    const next = new Date(dateStr + 'T00:00:00')
    do { next.setDate(next.getDate() + 7) } while (next <= now)
    return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`
  }

  const handlePersonalizar = (ev) => {
    setShowEditionPicker(null)
    setEditingId(null)
    setCreatedSlug(null)
    setNewEvt({
      name: ev.name || '',
      date: calcNextWeekStr(ev.date),
      time: ev.hora || '',
      price: ev.price || '',
      capacity: ev.capacity || '',
      description: ev.description || ''
    })
    setView('create')
  }

  const handleRenovarIgual = async (ev) => {
    setShowEditionPicker(null)
    setLoading(true)
    try {
      const nextDate = calcNextWeekStr(ev.date)
      const activityId = await saveActivity(ev.name, nextDate, ev.hora || '')
      await upsertActivityEvent(
        activityId,
        ev.name,
        parseFloat(ev.price) || 0,
        ev.description || '',
        nextDate,
        parseInt(ev.capacity) || 0
      )
      const [evs, archived, regs] = await Promise.all([getEvents(), getArchivedEvents(), getAllActivityRegistrations()])
      setEvents(evs)
      setArchivedEvents(archived)
      setAllRegs(regs)
      showToast(`"${ev.name}" publicado para ${nextDate}`)
    } catch (err) {
      console.error(err)
      showToast('Error al crear nueva edición', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    if (!newEvt.name.trim()) { showToast('El nombre es obligatorio', 'error'); return }
    if (!newEvt.date) { showToast('La fecha es obligatoria', 'error'); return }
    const price = parseFloat(newEvt.price) || 0
    const capacity = parseInt(newEvt.capacity) || 0
    if (price < 0) { showToast('El precio no puede ser negativo', 'error'); return }
    if (capacity < 0) { showToast('La capacidad no puede ser negativa', 'error'); return }
    setCreating(true)
    try {
      let activityId = editingId
      if (editingId) {
        await updateActivity(editingId, newEvt.name.trim(), newEvt.date, newEvt.time)
      } else {
        activityId = await saveActivity(newEvt.name.trim(), newEvt.date, newEvt.time)
      }

      if (!activityId) { showToast('Error al guardar la actividad', 'error'); return }

      const slug = await upsertActivityEvent(
        activityId,
        newEvt.name.trim(),
        price,
        (newEvt.description ?? '').trim(),
        newEvt.date,
        capacity
      )
      setCreatedSlug(slug)
      if (!editingId) {
        setNewEvt({ name: '', date: '', time: '', price: '', capacity: '', description: '' })
      }
      // Refresh events
      const [evs, archived, regs] = await Promise.all([getEvents(), getArchivedEvents(), getAllActivityRegistrations()])
      setEvents(evs)
      setArchivedEvents(archived)
      setAllRegs(regs)
      
      if (!slug || editingId) {
        setView('dashboard')
        setEditingId(null)
        if (editingId) showToast('Evento actualizado')
      }
    } catch (err) {
      console.error(err)
      showToast('Error al procesar el evento', 'error')
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
    showToast('Enlace copiado al portapapeles')
  }

  // Mantener refs en sincronía con el estado para que el polling no tenga stale closure
  useEffect(() => { selectedEventRef.current = selectedEvent }, [selectedEvent])
  useEffect(() => { viewRef.current = view }, [view])

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
    // Registrar para push notifications (FCM nativo o Web Push)
    subscribeToPush().catch(() => {})

    // Pide permiso para notificaciones del sistema al montar (browser fallback)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    const autoCloseExpired = async (evs) => {
      const now = new Date()
      const expired = evs.filter(ev => {
        if (!ev.date) return false
        const t = ev.hora || '23:59'
        return new Date(`${ev.date}T${t}`) < now
      })
      if (expired.length === 0) return { evs, changed: false }
      await Promise.all(expired.map(e => closeEvent(e.id)))
      const [fresh, freshArchived] = await Promise.all([getEvents(), getArchivedEvents()])
      return { evs: fresh, freshArchived, changed: true, names: expired.map(e => e.name) }
    }

    const applyNotifications = (regs) => {
      const { newRegs, newPayments } = checkStateChanges(regs)
      const items = []
      if (newRegs.length > 0) items.push(...newRegs.map(r => ({ type: 'reg', ...r })))
      if (newPayments > 0) items.push({ type: 'payment', count: newPayments, id: `pay_${Date.now()}` })
      if (items.length === 0) return

      setNotifCount(prev => prev + items.length)
      setNotifications(prev => [...items, ...prev])

      // Alerta con vibración + sonido + notificación del sistema
      const alertType = newPayments > 0 && newRegs.length === 0 ? 'payment' : 'reg'
      triggerAlert(alertType)

      if (newRegs.length > 0) {
        const msg = newRegs.length === 1
          ? `Nuevo registro: ${newRegs[0].full_name}`
          : `${newRegs.length} nuevos registros`
        showToast(msg, 'info')
        showSystemNotification('Nuevo registro', msg)
      }
      if (newPayments > 0) {
        const msg = `${newPayments} pago${newPayments > 1 ? 's' : ''} confirmado${newPayments > 1 ? 's' : ''}`
        showToast(msg, 'info')
        showSystemNotification('Pago confirmado', msg)
      }
    }

    setLoading(true)
    Promise.all([getEvents(), getArchivedEvents(), getAllActivityRegistrations()])
      .then(async ([evs, archived, regs]) => {
        const { evs: finalEvs, freshArchived, changed, names } = await autoCloseExpired(evs)
        setEvents(finalEvs)
        setArchivedEvents(changed ? freshArchived : archived)
        setAllRegs(regs)
        setShowSplash(false)
        if (changed) showToast(`${names.length === 1 ? `"${names[0]}"` : `${names.length} eventos`} cerrado${names.length > 1 ? 's' : ''} automáticamente`)
        applyNotifications(regs)
        const eid = searchParams.get('eid')
        if (eid && finalEvs.length > 0) {
          const ev = finalEvs.find(e => String(e.id) === String(eid))
          if (ev) viewAttendees(ev)
        }
      })
      .catch(err => console.error('Error loading data:', err))
      .finally(() => setLoading(false))

    // Re-check every 5 s para actualizaciones en tiempo real
    const intervalId = setInterval(async () => {
      try {
        const [evs, regsNow] = await Promise.all([getEvents(), getAllActivityRegistrations()])
        if (evs.length > 0) {
          const { changed, names, evs: fresh, freshArchived } = await autoCloseExpired(evs)
          if (changed) {
            setEvents(fresh)
            setArchivedEvents(freshArchived)
            showToast(`"${names.join(', ')}" cerrado automáticamente`)
          } else {
            setEvents(evs)
          }
        }
        setAllRegs(regsNow)
        applyNotifications(regsNow)

        // Actualizar la lista visible de asistentes si el usuario la está viendo
        if (viewRef.current === 'attendees') {
          const ev = selectedEventRef.current
          if (ev) {
            const evRegs = await getActivityRegistrationsByEvent(ev.id)
            setAttendees(evRegs)
          } else {
            setAttendees(regsNow)
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 30_000)
    return () => clearInterval(intervalId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const [showScanSheet, setShowScanSheet] = useState(false)
  const [scanSheetMode, setScanSheetMode] = useState(null) // null | 'ticket' | 'phone'
  const [ticketNum, setTicketNum] = useState('')
  const [phoneNum, setPhoneNum] = useState('')
  const [phoneResults, setPhoneResults] = useState(null) // null=sin buscar, []|[...]
  const [phoneBusy, setPhoneBusy] = useState(false)

  const handleScanQR = () => {
    setScanSheetMode(null)
    setTicketNum('')
    setPhoneNum('')
    setPhoneResults(null)
    setShowScanSheet(true)
  }

  const handlePhoneSearch = async (e) => {
    e?.preventDefault?.()
    const digits = String(phoneNum).replace(/\D/g, '')
    if (digits.length < 7) { showToast('Ingresa al menos 7 dígitos', 'error'); return }
    setPhoneBusy(true)
    setPhoneResults(null)
    try {
      const results = await getRegistrationsByPhone(digits)
      if (results.length === 1) {
        // Un solo registro esta semana → ir directo
        setShowScanSheet(false)
        setPhoneNum('')
        navigate(`/checkin?rid=${results[0].id}`)
      } else {
        setPhoneResults(results)
      }
    } catch {
      showToast('Error al buscar. Intenta de nuevo.', 'error')
    } finally {
      setPhoneBusy(false)
    }
  }

  const handleActualScan = () => {
    setShowScanSheet(false)
    // Esperar a que React elimine el overlay del DOM antes de abrir la cámara nativa
    setTimeout(() => {
      if (onStartScan) onStartScan()
      else navigate('/checkin')
    }, 250)
  }

  const handleManualTicket = (e) => {
    e?.preventDefault?.()
    const n = parseInt(String(ticketNum).trim(), 10)
    if (!n || isNaN(n) || n <= 0) { showToast('Ingresa un número de ticket válido', 'error'); return }
    setShowScanSheet(false)
    setTicketNum('')
    navigate(`/checkin?rid=${n}`)
  }

  const handleNavAsistentes = () => {
    viewAllAttendees('all')
  }

  const handleNavConfirmados = () => {
    viewAllAttendees('paid')
  }

  const handleNavPendientes = () => {
    viewAllAttendees('pending')
  }

  const [confirmingPaymentId, setConfirmingPaymentId] = useState(null)
  const [confirmingPresencialId, setConfirmingPresencialId] = useState(null)

  const refreshAttendees = async () => {
    // Siempre actualiza allRegs para mantener el conteo de pagados actualizado
    const all = await getAllActivityRegistrations()
    setAllRegs(all)
    // Sincroniza el watermark de pagos para que las confirmaciones del staff
    // no disparen una falsa notificación en el siguiente ciclo de polling
    syncPaidWatermark(all)
    if (selectedEvent) {
      const evRegs = await getActivityRegistrationsByEvent(selectedEvent.id)
      setAttendees(evRegs)
    } else {
      setAttendees(all)
    }
  }

  const handleConfirmPayment = async (registrationId) => {
    setConfirmingPaymentId(registrationId)
    try {
      await updateActivityRegistrationPayment(registrationId, true)
      await refreshAttendees()
      showToast('Pago confirmado')
    } catch {
      showToast('Error al confirmar el pago', 'error')
    } finally {
      setConfirmingPaymentId(null)
    }
  }

  const handleConfirmPresencial = async (registrationId) => {
    setConfirmingPresencialId(registrationId)
    try {
      await updateActivityRegistrationPayment(registrationId, true)
      await checkInRegistration(registrationId)
      await refreshAttendees()
      showToast('Pago cobrado · Asistencia confirmada')
    } catch {
      showToast('Error al confirmar', 'error')
    } finally {
      setConfirmingPresencialId(null)
    }
  }

  const isCheckedIn  = (r) => r.checked_in === 1  || r.checked_in === '1'
  const isPaid       = (r) => r.paid === 1         || r.paid === '1'
  const isTransfer   = (r) => (r.payment_method || '').toLowerCase().includes('transfer')

  const totalPaid    = allRegs.filter(isPaid).length
  const totalPending = allRegs.filter(r => !isPaid(r)).length

  const filteredAttendees = attendees.filter(a => {
    const matchSearch = (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.phone || '').includes(search)
    if (!matchSearch) return false
    if (filter === 'paid')     return isPaid(a)
    if (filter === 'pending')  return !isPaid(a)
    if (filter === 'attended') return isCheckedIn(a)
    return true
  })

  const paidCount     = attendees.filter(isPaid).length
  const pendingCount  = attendees.filter(r => !isPaid(r)).length
  const attendedCount = attendees.filter(isCheckedIn).length

  // ── Active tab logic ──
  const activeTab = view === 'dashboard'
    ? 'home'
    : view === 'create' || view === 'events_list' ? 'events'
    : filter === 'paid' ? 'confirmed'
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
          <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        <span>Pagados</span>
      </button>
    </nav>
  )

  // ── Scan Sheet Portal — definido aquí (no dentro de BottomNav) para
  //    evitar desmontaje por re-render al escribir en los inputs ──
  const scanPortal = showScanSheet && createPortal(
    <div className="sa-modal-overlay" onClick={() => setShowScanSheet(false)}>
      <div className="sa-scan-sheet" onClick={e => e.stopPropagation()}>
        <div className="sa-scan-sheet-handle" />
        <p className="sa-scan-sheet-title">Verificar acceso</p>

        <button className="sa-scan-option" onClick={handleActualScan}>
          <div className="sa-scan-option-icon sa-scan-option-icon--qr">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <path d="M14 14h3v3h-3zM18 17h3v3h-3zM14 18h3v3h-3zM18 14h3v3h-3z"/>
            </svg>
          </div>
          <div className="sa-scan-option-text">
            <span className="sa-scan-option-label">Escanear QR</span>
            <span className="sa-scan-option-hint">Apunta la cámara al código QR del invitado</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button className="sa-scan-option" onClick={() => setScanSheetMode(m => m === 'phone' ? null : 'phone')}>
          <div className="sa-scan-option-icon sa-scan-option-icon--phone">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.16 6.16l1.02-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <div className="sa-scan-option-text">
            <span className="sa-scan-option-label">Número de teléfono</span>
            <span className="sa-scan-option-hint">Registro reciente de esta semana</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round">
            {scanSheetMode === 'phone' ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
          </svg>
        </button>

        {scanSheetMode === 'phone' && (
          <div className="sa-scan-phone-block">
            <form className="sa-scan-ticket-form" onSubmit={handlePhoneSearch}>
              <input
                type="tel"
                inputMode="numeric"
                className="sa-input"
                placeholder="Ej. 4431234567"
                value={phoneNum}
                onChange={e => setPhoneNum(e.target.value)}
                autoFocus
              />
              <button type="submit" className="sa-scan-ticket-btn" disabled={phoneBusy}>
                {phoneBusy ? '…' : 'Buscar'}
              </button>
            </form>
            {phoneResults !== null && phoneResults.length === 0 && (
              <p className="sa-scan-phone-empty">Sin registro esta semana. Usa número de ticket.</p>
            )}
            {phoneResults !== null && phoneResults.length > 1 && (
              <div className="sa-scan-phone-results">
                {phoneResults.map(r => (
                  <button key={r.id} className="sa-scan-phone-row" onClick={() => {
                    setShowScanSheet(false); setPhoneNum(''); setPhoneResults(null)
                    navigate(`/checkin?rid=${r.id}`)
                  }}>
                    <div className="sa-scan-phone-row-info">
                      <span className="sa-scan-phone-row-name">{r.full_name}</span>
                      <span className="sa-scan-phone-row-event">{r.event_name || r.activity_name} · #{String(r.id).padStart(4,'0')}</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="sa-scan-option" onClick={() => setScanSheetMode(m => m === 'ticket' ? null : 'ticket')}>
          <div className="sa-scan-option-icon sa-scan-option-icon--ticket">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z"/>
              <line x1="12" y1="7" x2="12" y2="17" strokeDasharray="2 3"/>
            </svg>
          </div>
          <div className="sa-scan-option-text">
            <span className="sa-scan-option-label">Número de ticket</span>
            <span className="sa-scan-option-hint">Si el invitado no trae QR ni PDF</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round">
            {scanSheetMode === 'ticket' ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
          </svg>
        </button>

        {scanSheetMode === 'ticket' && (
          <form className="sa-scan-ticket-form" onSubmit={handleManualTicket}>
            <input
              type="number"
              inputMode="numeric"
              className="sa-input"
              placeholder="Ej. 1234"
              value={ticketNum}
              onChange={e => setTicketNum(e.target.value)}
              autoFocus
            />
            <button type="submit" className="sa-scan-ticket-btn">Buscar</button>
          </form>
        )}

        <button className="sa-scan-cancel" onClick={() => setShowScanSheet(false)}>Cancelar</button>
      </div>
    </div>,
    document.body
  )

  // ── Panel de administrador (movil) ──
  if (view === 'admin') {
    const allEvs = [...events, ...archivedEvents]
    const priceById = {}
    allEvs.forEach(e => { priceById[String(e.id)] = Number(e.price) || 0 })
    const gPaid = allRegs.filter(isPaid).length
    const gPending = allRegs.length - gPaid
    const gAttended = allRegs.filter(isCheckedIn).length
    const gRevenue = allRegs.filter(isPaid).reduce((s, r) => s + (priceById[String(r.event_id)] || 0), 0)
    const attRate = allRegs.length > 0 ? Math.round((gAttended / allRegs.length) * 100) : 0
    // Top eventos por registros
    const byEvent = {}
    allRegs.forEach(r => { const k = r.event_name || 'Sin evento'; byEvent[k] = (byEvent[k] || 0) + 1 })
    const topEvents = Object.entries(byEvent).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const maxTop = topEvents.length ? topEvents[0][1] : 1
    // Historial de actividad reciente: registros, pagos y checkins, más recientes primero
    const activityLog = allRegs
      .flatMap(r => {
        const items = [{ ts: r.created_at, label: 'Registro', name: r.full_name, event: r.event_name }]
        if (r.paid_at) items.push({ ts: r.paid_at, label: 'Pago', name: r.full_name, event: r.event_name })
        if (r.checked_in_at) items.push({ ts: r.checked_in_at, label: 'Check-in', name: r.full_name, event: r.event_name })
        return items
      })
      .filter(i => i.ts)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 20)

    return (
      <div className="sa-root sa-root--admin">
        <div className="sa-sticky-top sa-top-gradient">
          <header className="sa-attendees-header">
            <button className="sa-back-btn" onClick={() => setView('dashboard')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="sa-header-titles">
              <span className="sa-h-title">Administrador</span>
              <span className="sa-h-subtitle">Control y usuarios</span>
            </div>
            <span style={{ width: 40 }} />
          </header>
        </div>

        <div className="sa-body">
          <h2 className="sa-adm-h">Resumen general</h2>
          <div className="sa-adm-grid">
            <div className="sa-adm-metric"><span className="sa-adm-num">{allEvs.length}</span><span className="sa-adm-lbl">Eventos</span></div>
            <div className="sa-adm-metric"><span className="sa-adm-num">{allRegs.length}</span><span className="sa-adm-lbl">Registros</span></div>
            <div className="sa-adm-metric sa-adm-metric--money"><span className="sa-adm-num">${gRevenue.toLocaleString('es-MX')}</span><span className="sa-adm-lbl">Recaudado</span></div>
            <div className="sa-adm-metric"><span className="sa-adm-num">{gPaid}</span><span className="sa-adm-lbl">Pagados</span></div>
            <div className="sa-adm-metric"><span className="sa-adm-num" style={{ color: '#9a6b06' }}>{gPending}</span><span className="sa-adm-lbl">Pendientes</span></div>
            <div className="sa-adm-metric"><span className="sa-adm-num" style={{ color: '#1f7a44' }}>{attRate}%</span><span className="sa-adm-lbl">Asistencia</span></div>
          </div>

          <h2 className="sa-adm-h">Eventos con más registros</h2>
          <div className="sa-adm-card">
            {topEvents.length === 0 ? (
              <p className="sa-adm-empty">Sin registros aún</p>
            ) : topEvents.map(([name, n]) => (
              <div key={name} className="sa-adm-bar-row">
                <span className="sa-adm-bar-name">{name}</span>
                <div className="sa-adm-bar-track"><div className="sa-adm-bar-fill" style={{ width: `${Math.round((n / maxTop) * 100)}%` }} /></div>
                <span className="sa-adm-bar-val">{n}</span>
              </div>
            ))}
          </div>

          <h2 className="sa-adm-h">Historial de actividad</h2>
          <div className="sa-adm-card">
            {activityLog.length === 0 ? (
              <p className="sa-adm-empty">Sin actividad aún</p>
            ) : activityLog.map((item, idx) => (
              <div key={idx} className="sa-adm-log-row">
                <span className={`sa-adm-log-tag sa-adm-log-tag--${item.label === 'Pago' ? 'pago' : item.label === 'Check-in' ? 'checkin' : 'registro'}`}>
                  {item.label}
                </span>
                <div className="sa-adm-log-info">
                  <span className="sa-adm-log-name">{item.name || 'Sin nombre'}</span>
                  <span className="sa-adm-log-event">{item.event || 'Sin evento'}</span>
                </div>
                <span className="sa-adm-log-time">{timeAgoShort(item.ts)}</span>
              </div>
            ))}
          </div>

          <div className="sa-section-header">
            <h2 className="sa-adm-h" style={{ margin: 0 }}>Usuarios</h2>
            <button
              className="sa-adm-pw-btn"
              onClick={() => {
                setShowNewUser(v => !v)
                setNewUserName(''); setNewUserPw(''); setNewUserRole('staff'); setNewUserMustChange(true); setNewUserErr(''); setNewUserDone('')
              }}
            >
              {showNewUser ? 'Cancelar' : '+ Nuevo usuario'}
            </button>
          </div>

          {showNewUser && (
            <div className="sa-adm-card" style={{ marginBottom: 12 }}>
              {newUserDone ? (
                <div className="sa-adm-pw-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#666' }}>Usuario "{newUserName}" creado. Clave genérica, envíasela:</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, background: '#eef0e3', padding: '6px 12px', borderRadius: 6 }}>{newUserDone}</code>
                    <button className="sa-adm-pw-save" onClick={() => navigator.clipboard?.writeText(newUserDone)}>Copiar</button>
                  </div>
                  <span style={{ fontSize: 12, color: '#888' }}>Al ingresar deberá crear su contraseña.</span>
                  <button className="sa-adm-pw-save" onClick={() => { setShowNewUser(false); setNewUserName(''); setNewUserPw(''); setNewUserDone('') }}>Listo</button>
                </div>
              ) : (
                <>
                  <div className="sa-adm-pw-row sa-adm-pw-row--stack">
                    <input
                      type="text"
                      className="sa-input"
                      placeholder="nombre.usuario"
                      value={newUserName}
                      onChange={e => { setNewUserName(e.target.value); setNewUserErr('') }}
                      autoCapitalize="none"
                      autoComplete="off"
                    />
                    <input
                      type="text"
                      className="sa-input"
                      placeholder="Contraseña (mín. 6)"
                      value={newUserPw}
                      onChange={e => { setNewUserPw(e.target.value); setNewUserErr('') }}
                    />
                    <div className="sa-adm-pw-btnrow">
                      <button className="sa-adm-pw-btn" onClick={() => setNewUserPw(genGenericPassword())}>
                        Generar genérica
                      </button>
                    </div>
                    <div className="sa-adm-roles">
                      {['staff', 'admin', 'editor'].map(r => (
                        <button
                          key={r}
                          type="button"
                          className={`sa-adm-role-btn ${newUserRole === r ? 'sa-adm-role-btn--on' : ''}`}
                          onClick={() => setNewUserRole(r)}
                        >
                          {r === 'staff' ? 'Staff' : r === 'admin' ? 'Admin' : 'Editor'}
                        </button>
                      ))}
                    </div>
                    <label className="sa-adm-pw-chk">
                      <input type="checkbox" checked={newUserMustChange} onChange={e => setNewUserMustChange(e.target.checked)} />
                      Pedir cambio de contraseña al primer ingreso
                    </label>
                    {newUserErr && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{newUserErr}</p>}
                    <button className="sa-adm-pw-save" disabled={creatingUser} onClick={createNewUser}>
                      {creatingUser ? 'Creando…' : 'Crear usuario'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="sa-adm-card">
            {loadingUsers ? (
              <p className="sa-adm-empty">Cargando…</p>
            ) : adminUsers.length === 0 ? (
              <p className="sa-adm-empty">Sin usuarios</p>
            ) : adminUsers.map(u => (
              <div key={u.id} className="sa-adm-user">
                <div className="sa-adm-user-head">
                  <div className="sa-adm-user-info">
                    <span className="sa-adm-user-name">{u.username}</span>
                    <span className="sa-adm-user-role">{u.role || 'editor'}</span>
                  </div>
                  <button className="sa-adm-pw-btn" onClick={() => { setPwTarget(pwTarget === u.username ? null : u.username); setPwValue(''); setPwGeneric(true); setPwDone('') }}>
                    {pwTarget === u.username ? 'Cancelar' : 'Resetear contraseña'}
                  </button>
                </div>
                {pwTarget === u.username && (
                  pwDone ? (
                    <div className="sa-adm-pw-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 13, color: '#666' }}>Clave genérica. Envíasela:</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <code style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, background: '#eef0e3', padding: '6px 12px', borderRadius: 6 }}>{pwDone}</code>
                        <button className="sa-adm-pw-save" onClick={() => navigator.clipboard?.writeText(pwDone)}>Copiar</button>
                      </div>
                      <span style={{ fontSize: 12, color: '#888' }}>Al ingresar deberá crear su contraseña.</span>
                      <button className="sa-adm-pw-save" onClick={() => { setPwTarget(null); setPwValue(''); setPwDone('') }}>Listo</button>
                    </div>
                  ) : (
                  <div className="sa-adm-pw-row sa-adm-pw-row--stack">
                    <input
                      type="text"
                      className="sa-input"
                      placeholder="Nueva contraseña"
                      value={pwValue}
                      onChange={e => setPwValue(e.target.value)}
                      autoFocus
                    />
                    <div className="sa-adm-pw-btnrow">
                      <button className="sa-adm-pw-btn" onClick={() => { setPwValue(genGenericPassword()); setPwGeneric(true) }}>
                        Generar genérica
                      </button>
                      <button className="sa-adm-pw-save" disabled={pwSaving} onClick={() => savePassword(u.username)}>
                        {pwSaving ? '…' : 'Guardar'}
                      </button>
                    </div>
                    <label className="sa-adm-pw-chk">
                      <input type="checkbox" checked={pwGeneric} onChange={e => setPwGeneric(e.target.checked)} />
                      Pedir cambio al primer ingreso
                    </label>
                  </div>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        <BottomNav />
        {scanPortal}
        {modal && <StaffModal {...modal} onCancel={() => setModal(null)} />}
        {toast && <StaffToast message={toast.message} type={toast.type} />}
      </div>
    )
  }

  // ── Dashboard ──
  if (view === 'dashboard') {
    return (
      <div className="sa-root">
        {showSplash && (
          <div className="sa-splash">
            <div className="sa-splash-skeleton">
              {/* top bar */}
              <div className="sa-skel-topbar">
                <div className="sa-skel-avatar" />
                <div className="sa-skel-greeting">
                  <div className="sa-skel-line sa-skel-line--sm" />
                  <div className="sa-skel-line sa-skel-line--md" />
                </div>
                <div className="sa-skel-icon-btn" />
              </div>
              {/* stats */}
              <div className="sa-skel-stats">
                {[1,2,3].map(i => <div key={i} className="sa-skel-stat-box" />)}
              </div>
              {/* tabs */}
              <div className="sa-skel-tabs">
                {[1,2,3].map(i => <div key={i} className="sa-skel-tab" />)}
              </div>
              {/* cards */}
              <div className="sa-skel-cards">
                {[1,2,3].map(i => (
                  <div key={i} className="sa-skel-card">
                    <div className="sa-skel-card-icon" />
                    <div className="sa-skel-card-body">
                      <div className="sa-skel-line sa-skel-line--lg" />
                      <div className="sa-skel-line sa-skel-line--md" />
                      <div className="sa-skel-line sa-skel-line--sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <section className="sa-header-hero-section">
          <div className="sa-top-bar">
            <button className="sa-top-left sa-top-left--btn" onClick={() => setShowMenu(true)} aria-label="Abrir menú">
              <div className="sa-avatar-circle">
                <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="sa-avatar-logo" />
              </div>
              <div className="sa-greeting-block">
                <span className="sa-greeting-sub">Bienvenido</span>
                <span className="sa-greeting-role">
                  {role === 'admin' ? 'Administrador' : 'Staff'}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sa-greeting-caret">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </span>
              </div>
            </button>
            <div className="sa-top-actions">
              <button className="sa-notif-btn" aria-label="Notificaciones" onClick={handleNotifClick}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {notifCount > 0 && (
                  <span className="sa-notif-count">{notifCount > 9 ? '9+' : notifCount}</span>
                )}
              </button>
            </div>
          </div>

          <div className="sa-hero-content">
            <p className="sa-hero-label">HOTEL PUNTA GALERÍA</p>
            <h1 className="sa-hero-title">Panel de Accesos</h1>
            {appVersion && (
              <span className="sa-hero-ver" onClick={openVersions}>{appVersion}</span>
            )}
          </div>

          <div className="sa-stats-grid">
            <div className="sa-stat-card">
              <span className="sa-stat-num">{loading ? '…' : events.length}</span>
              <span className="sa-stat-label">Eventos</span>
            </div>
            <div className="sa-stat-card sa-stat-card--active">
              <span className="sa-stat-num">{loading ? '…' : totalPaid}</span>
              <span className="sa-stat-label">Pagados</span>
            </div>
            <div className="sa-stat-card">
              <span className="sa-stat-num">{loading ? '…' : totalPending}</span>
              <span className="sa-stat-label">Pendientes</span>
            </div>
          </div>
        </section>

        <div className="sa-body">
          {updateAvailable && latestVer.version !== updateDismissed && (
            <div className="sa-update-banner">
              <div className="sa-update-banner-left">
                <div className="sa-update-dot" />
                <div>
                  <span className="sa-update-title">Nueva versión disponible</span>
                  <span className="sa-update-sub">{appVersion} → {latestVer.label}</span>
                </div>
              </div>
              <div className="sa-update-actions">
                <button className="sa-update-btn" onClick={openVersions}>Ver</button>
                <button className="sa-update-dismiss" onClick={() => {
                  try { localStorage.setItem('update_dismissed', latestVer.version) } catch {}
                  setUpdateDismissed(latestVer.version)
                }}>✕</button>
              </div>
            </div>
          )}

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
                const paidE = evRegs.filter(isPaid).length
                const pendingE = registered - paidE

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
                        {getActivityIcon(ev.name)}
                      </div>
                      <div className="sa-ev-info">
                        <span className="sa-ev-name">{ev.name}</span>
                        <span className="sa-ev-date">{fmtEventDate(ev.date)}</span>
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
                          </span>
                        ) : (
                          <span className="sa-progress-label">
                            <b>{registered}</b> registrados
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
                      {registered > 0 && (
                        <div className="sa-ev-breakdown">
                          {paidE > 0 && <span className="sa-evb sa-evb--paid">{paidE} pagados</span>}
                          {pendingE > 0 && <span className="sa-evb sa-evb--pend">{pendingE} pendientes</span>}
                          {checkedIn > 0 && <span className="sa-evb sa-evb--att">{checkedIn} asistieron</span>}
                        </div>
                      )}
                    </div>

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
                        {canCreate && (
                          <button className="sa-share-btn sa-share-btn--close" onClick={e => handleCloseEvent(ev, e)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Cerrar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {archivedEvents.length > 0 && (
          <div className="sa-history-section">
            <div className="sa-section-header">
              <h2 className="sa-section-title">Historial</h2>
              <span className="sa-badge-count">{archivedEvents.length}</span>
            </div>
            <div className="sa-event-list">
              {archivedEvents.map((ev, idx) => {
                const evRegs = allRegs.filter(r => String(r.event_id) === String(ev.id))
                const total = evRegs.length
                const paid = evRegs.filter(isPaid).length
                const attended = evRegs.filter(isCheckedIn).length
                return (
                  <div key={ev.id} className="sa-event-card sa-event-card--archived" style={{ animationDelay: `${idx * 0.05}s`, cursor: 'pointer' }} onClick={() => viewAttendees(ev)}>
                    <div className="sa-event-main">
                      <div className="sa-icon-box sa-icon-box--archived">
                        {getActivityIcon(ev.name)}
                      </div>
                      <div className="sa-ev-info">
                        <span className="sa-ev-name">{ev.name}</span>
                        <span className="sa-ev-date">
                          {fmtEventDate(ev.date)}
                          <span className="sa-ev-closed">{closedRelative(ev.date)}</span>
                        </span>
                      </div>
                      <div className="sa-arrow-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    </div>
                    <div className="sa-archived-stats">
                      <span className="sa-archived-stat"><b>{total}</b> registrados</span>
                      <span className="sa-archived-stat sa-archived-stat--paid"><b>{paid}</b> pagados</span>
                      <span className="sa-archived-stat sa-archived-stat--attended"><b>{attended}</b> asistieron</span>
                    </div>
                    {(canCreate || lowerRole === 'admin') && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {canCreate && (
                          <button className="sa-new-edition-btn sa-new-edition-btn--full" onClick={e => { e.stopPropagation(); setShowEditionPicker(ev) }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                            </svg>
                            Nueva edición
                          </button>
                        )}
                        {lowerRole === 'admin' && (
                          <button
                            className="sa-edit-card-btn"
                            onClick={e => { e.stopPropagation(); handleDeleteEvent(ev) }}
                            style={{ background: '#fff1f2', color: '#ef4444', flex: '0 0 auto' }}
                            title="Eliminar evento"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {canCreate && view !== 'create' && (
          <button className="sa-fab" onClick={handleCreateView} aria-label="Nuevo Evento">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}

        {showEditionPicker && (
          <div className="sa-picker-overlay" onClick={() => setShowEditionPicker(null)}>
            <div className="sa-picker-sheet" onClick={e => e.stopPropagation()}>
              <div className="sa-picker-header">
                <span className="sa-picker-title">Nueva edición</span>
                <span className="sa-picker-subtitle">{showEditionPicker.name}</span>
              </div>
              <button className="sa-edition-opt sa-edition-opt--primary" onClick={() => handleRenovarIgual(showEditionPicker)}>
                <div className="sa-edition-opt-icon sa-edition-opt-icon--green">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                </div>
                <div className="sa-edition-opt-body">
                  <span className="sa-edition-opt-title">Renovar igual</span>
                  <span className="sa-edition-opt-sub">Lista nueva · siguiente semana</span>
                  <div className="sa-edition-opt-tags">
                    {parseFloat(showEditionPicker.price) > 0
                      ? <span className="sa-edition-tag">${parseFloat(showEditionPicker.price).toFixed(0)}</span>
                      : <span className="sa-edition-tag">Gratuito</span>}
                    {parseInt(showEditionPicker.capacity) > 0 && <span className="sa-edition-tag">{showEditionPicker.capacity} lugares</span>}
                    {showEditionPicker.hora && <span className="sa-edition-tag">{showEditionPicker.hora}</span>}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button className="sa-edition-opt" onClick={() => handlePersonalizar(showEditionPicker)}>
                <div className="sa-edition-opt-icon sa-edition-opt-icon--olive">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <div className="sa-edition-opt-body">
                  <span className="sa-edition-opt-title">Personalizar</span>
                  <span className="sa-edition-opt-sub">Editar detalles antes de publicar</span>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        )}
        {showNotifPanel && (
          <div className="sa-picker-overlay" onClick={() => setShowNotifPanel(false)}>
            <div className="sa-picker-sheet" onClick={e => e.stopPropagation()}>
              <div className="sa-picker-header">
                <span className="sa-picker-title">Notificaciones</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {notifications.length > 0 && (
                    <button
                      style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 700, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}
                      onClick={() => { setNotifications([]); setNotifCount(0) }}
                    >
                      Limpiar
                    </button>
                  )}
                  <button className="sa-picker-close" onClick={() => setShowNotifPanel(false)}>✕</button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="sa-notif-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  <p>Sin notificaciones nuevas</p>
                  <p>Se revisa cada 30 segundos</p>
                </div>
              ) : (
                <div className="sa-picker-list">
                  {notifications.map(item => item.type === 'payment' ? (
                    <div key={item.id} className="sa-notif-item sa-notif-item--payment">
                      <div className="sa-notif-avatar sa-notif-avatar--payment">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                        </svg>
                      </div>
                      <div className="sa-notif-body">
                        <span className="sa-notif-name">
                          {item.count === 1 ? 'Pago confirmado' : `${item.count} pagos confirmados`}
                        </span>
                        <span className="sa-notif-detail">Transferencia recibida</span>
                      </div>
                      <span className="sa-notif-badge sa-notif-badge--payment">Pago</span>
                    </div>
                  ) : (
                    <div key={item.id} className="sa-notif-item" onClick={() => {
                      setShowNotifPanel(false)
                      navigate(`/checkin?rid=${item.id}`)
                    }}>
                      <div className="sa-notif-avatar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                      <div className="sa-notif-body">
                        <span className="sa-notif-name">{item.full_name}</span>
                        <span className="sa-notif-detail">
                          {item.payment_method || 'Pago presencial'}{item.phone ? ` · ${item.phone}` : ''}
                        </span>
                      </div>
                      <span className="sa-notif-badge">Registro</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <BottomNav />
        {scanPortal}
        {showMenu && (
          <div className="sa-sheet-overlay" onClick={e => { if (e.target === e.currentTarget) setShowMenu(false) }}>
            <div className="sa-sheet">
              <span className="sa-sheet-grip" />
              <div className="sa-sheet-head">
                <div className="sa-sheet-avatar">
                  <img src="/logo/logNegro.svg" alt="" className="sa-avatar-logo" />
                </div>
                <div className="sa-sheet-head-info">
                  <span className="sa-sheet-name">{role === 'admin' ? 'Administrador' : 'Staff'}</span>
                  <span className="sa-sheet-sub">Hotel Punta Galería</span>
                </div>
              </div>

              <div className="sa-sheet-list">
                <button className="sa-sheet-item" onClick={openVersions}>
                  <span className="sa-sheet-ic">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                  </span>
                  <span className="sa-sheet-label">Versiones y actualizaciones</span>
                  <span className="sa-sheet-mini">{onRemoteBuild ? 'En línea' : 'Instalada'}</span>
                  <svg className="sa-sheet-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                <button className="sa-sheet-item" onClick={() => { setShowMenu(false); handleNotifClick() }}>
                  <span className="sa-sheet-ic">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  </span>
                  <span className="sa-sheet-label">Notificaciones</span>
                  {notifCount > 0 && <span className="sa-sheet-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
                  <svg className="sa-sheet-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                {lowerRole === 'admin' && (
                  <button className="sa-sheet-item" onClick={() => { setShowMenu(false); handleTestPush() }}>
                    <span className="sa-sheet-ic">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </span>
                    <span className="sa-sheet-label">Probar notificación push</span>
                    <svg className="sa-sheet-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}

                {lowerRole === 'admin' && (
                  <button className="sa-sheet-item" onClick={() => { setShowMenu(false); setView('admin') }}>
                    <span className="sa-sheet-ic">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="12" y="6" width="3" height="11"/><rect x="17" y="13" width="3" height="4"/></svg>
                    </span>
                    <span className="sa-sheet-label">Panel de administrador</span>
                    <svg className="sa-sheet-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}

                {lowerRole === 'admin' && (
                  <button className="sa-sheet-item sa-sheet-item--danger" onClick={handleResetAll}>
                    <span className="sa-sheet-ic">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                    </span>
                    <span className="sa-sheet-label">Borrar todo (dejar como nueva)</span>
                    <svg className="sa-sheet-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}

                <button className="sa-sheet-item sa-sheet-item--danger" onClick={() => { setShowMenu(false); onLogout() }}>
                  <span className="sa-sheet-ic">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  </span>
                  <span className="sa-sheet-label">Cerrar sesión</span>
                </button>
              </div>

              <span className="sa-sheet-version">{onRemoteBuild ? 'En línea' : 'Instalada'} · {appVersion || '—'}</span>
            </div>
          </div>
        )}
        {showVersions && (
          <div className="sa-sheet-overlay" onClick={e => { if (e.target === e.currentTarget) setShowVersions(false) }}>
            <div className="sa-sheet">
              <span className="sa-sheet-grip" />
              <h3 className="sa-ver-title">Versiones</h3>

              <div className="sa-ver-card sa-ver-card--current">
                <div className="sa-ver-row">
                  <span className="sa-ver-tag sa-ver-tag--on">EN USO</span>
                  <span className="sa-ver-mode">{onRemoteBuild ? 'En línea' : 'Instalada'}</span>
                </div>
                <span className="sa-ver-code">{appVersion || 'desconocida'}</span>
              </div>

              <div className="sa-ver-card">
                <div className="sa-ver-row">
                  <span className="sa-ver-tag">ÚLTIMA PUBLICADA</span>
                  {latestVer === undefined && <span className="sa-ver-mode">Consultando…</span>}
                  {latestVer === null && <span className="sa-ver-mode sa-ver-mode--err">Sin conexión</span>}
                  {latestVer && !updateAvailable && <span className="sa-ver-mode sa-ver-mode--ok">Al día</span>}
                  {latestVer && updateAvailable && <span className="sa-ver-mode sa-ver-mode--new">Nueva</span>}
                </div>
                <span className="sa-ver-code">{latestVer?.label || (latestVer === null ? '—' : '…')}</span>
              </div>

              <div className="sa-ver-actions">
                {updateAvailable && (
                  <button className="sa-ver-btn" onClick={loadOnline}>
                    Actualizar a {latestVer.label}
                  </button>
                )}
                {onRemoteBuild && (
                  <button className="sa-ver-btn sa-ver-btn--soft" onClick={() => { setShowVersions(false); backToInstalled() }}>
                    Volver a versión instalada
                  </button>
                )}
                {!updateAvailable && !onRemoteBuild && latestVer && (
                  <button className="sa-ver-btn sa-ver-btn--soft" disabled>Estás en la última versión</button>
                )}
                {latestVer === null && (
                  <button className="sa-ver-btn sa-ver-btn--soft" onClick={openVersions}>Reintentar</button>
                )}
                <button className="sa-ver-close" onClick={() => setShowVersions(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}
        {modal && <StaffModal {...modal} onCancel={() => setModal(null)} />}
        {toast && <StaffToast message={toast.message} type={toast.type} />}
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
                      {getActivityIcon(ev.name)}
                    </div>
                    <div className="sa-ev-info">
                      <span className="sa-ev-name">{ev.name}</span>
                      <span className="sa-ev-date">{fmtEventDate(ev.date)} • {ev.hora || 'Sin hora'}</span>
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
                        onClick={e => handleCloseEvent(ev, e)}
                        style={{ background: '#fff7ed', color: '#ea580c' }}
                        title="Cerrar evento"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </button>
                      {lowerRole === 'admin' && (
                        <button
                          className="sa-edit-card-btn"
                          onClick={() => handleDeleteEvent(ev)}
                          style={{ background: '#fff1f2', color: '#ef4444' }}
                          title="Eliminar evento"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {archivedEvents.length > 0 && (
            <>
              <div className="sa-section-header" style={{ marginTop: 24 }}>
                <h2 className="sa-section-title">Historial</h2>
                <span className="sa-badge-count">{archivedEvents.length}</span>
              </div>
              <div className="sa-event-list">
                {archivedEvents.map((ev, idx) => {
                  const evRegs = allRegs.filter(r => String(r.event_id) === String(ev.id))
                  return (
                    <div key={ev.id} className="sa-event-card sa-event-card--archived" style={{ animationDelay: `${idx * 0.05}s`, cursor: 'pointer' }} onClick={() => viewAttendees(ev)}>
                      <div className="sa-event-main" style={{ marginBottom: 0 }}>
                        <div className="sa-icon-box sa-icon-box--archived">
                          {getActivityIcon(ev.name)}
                        </div>
                        <div className="sa-ev-info">
                          <span className="sa-ev-name">{ev.name}</span>
                          <span className="sa-ev-date">
                            {fmtEventDate(ev.date)} · {evRegs.length} reg.
                            <span className="sa-ev-closed">{closedRelative(ev.date)}</span>
                          </span>
                        </div>
                        <button
                          className="sa-new-edition-btn sa-new-edition-btn--compact"
                          onClick={e => { e.stopPropagation(); setShowEditionPicker(ev) }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                          </svg>
                          Nueva edición
                        </button>
                        {lowerRole === 'admin' && (
                          <button
                            className="sa-edit-card-btn"
                            onClick={e => { e.stopPropagation(); handleDeleteEvent(ev) }}
                            style={{ background: '#fff1f2', color: '#ef4444' }}
                            title="Eliminar evento"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {canCreate && (
          <button className="sa-fab" onClick={handleCreateView} aria-label="Nuevo Evento">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}

        {showEditionPicker && (
          <div className="sa-picker-overlay" onClick={() => setShowEditionPicker(null)}>
            <div className="sa-picker-sheet" onClick={e => e.stopPropagation()}>
              <div className="sa-picker-header">
                <span className="sa-picker-title">Nueva edición</span>
                <span className="sa-picker-subtitle">{showEditionPicker.name}</span>
              </div>
              <button className="sa-edition-opt sa-edition-opt--primary" onClick={() => handleRenovarIgual(showEditionPicker)}>
                <div className="sa-edition-opt-icon sa-edition-opt-icon--green">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                </div>
                <div className="sa-edition-opt-body">
                  <span className="sa-edition-opt-title">Renovar igual</span>
                  <span className="sa-edition-opt-sub">Lista nueva · siguiente semana</span>
                  <div className="sa-edition-opt-tags">
                    {parseFloat(showEditionPicker.price) > 0
                      ? <span className="sa-edition-tag">${parseFloat(showEditionPicker.price).toFixed(0)}</span>
                      : <span className="sa-edition-tag">Gratuito</span>}
                    {parseInt(showEditionPicker.capacity) > 0 && <span className="sa-edition-tag">{showEditionPicker.capacity} lugares</span>}
                    {showEditionPicker.hora && <span className="sa-edition-tag">{showEditionPicker.hora}</span>}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button className="sa-edition-opt" onClick={() => handlePersonalizar(showEditionPicker)}>
                <div className="sa-edition-opt-icon sa-edition-opt-icon--olive">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <div className="sa-edition-opt-body">
                  <span className="sa-edition-opt-title">Personalizar</span>
                  <span className="sa-edition-opt-sub">Editar detalles antes de publicar</span>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        )}
        <BottomNav />
        {scanPortal}
        {modal && <StaffModal {...modal} onCancel={() => setModal(null)} />}
        {toast && <StaffToast message={toast.message} type={toast.type} />}
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
            <div className="sa-success">
              <div className="sa-success-check">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>

              <div>
                <h2 className="sa-form-title">¡Listo para compartir!</h2>
                <p className="sa-form-sub">Envía la invitación o copia el enlace.</p>
              </div>

              <div className="sa-success-actions">
                <button className="sa-act sa-act--wa" onClick={() => { setAutoClose(null); shareInvitation() }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8 1 .9 1.7 1.1 2 1.3.3.1.4.1.6-.1l.7-.9c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.1.1.7-.2 1.4z"/>
                  </svg>
                  WhatsApp
                </button>
                <button className="sa-act sa-act--copy" onClick={() => { setAutoClose(null); copyInvitation() }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copiar
                </button>
              </div>

              <button className="sa-success-counter" onClick={goHome} aria-label="Ir al inicio ahora">
                <span className="sa-counter-num">{autoClose ?? 0}</span>
                <span className="sa-counter-label">Volviendo al inicio…</span>
                <span className="sa-counter-hint">Toca para ir ahora</span>
              </button>
            </div>
          </div>
          <BottomNav />
          {scanPortal}
          {modal && <StaffModal {...modal} onCancel={() => setModal(null)} />}
          {toast && <StaffToast message={toast.message} type={toast.type} />}
        </div>
      )
    }

    return (
      <div className="sa-root sa-root--create">
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
            <span className="sa-form-accent" />

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

            <div className="sa-section-divider"><span>Fecha y hora</span></div>

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

            <div className="sa-section-divider"><span>Precio y aforo</span></div>

            <div className="sa-grid-2">
              <div className="sa-field">
                <label className="sa-label">Precio</label>
                <div className="sa-input-affix">
                  <span className="sa-input-prefix">$</span>
                  <input
                    type="number"
                    min="0"
                    className="sa-input sa-input--affixed"
                    placeholder="0.00"
                    value={newEvt.price}
                    onChange={e => setNewEvt({ ...newEvt, price: e.target.value })}
                  />
                </div>
              </div>
              <div className="sa-field">
                <label className="sa-label">Lugares</label>
                <input
                  type="number"
                  min="0"
                  className="sa-input"
                  placeholder="Capacidad"
                  value={newEvt.capacity}
                  onChange={e => setNewEvt({ ...newEvt, capacity: e.target.value })}
                />
              </div>
            </div>

            <div className="sa-section-divider"><span>Descripción</span></div>

            <div className="sa-field">
              <div className="sa-field-head">
                <label className="sa-label">Detalles</label>
                <button
                  type="button"
                  className="sa-ai-btn"
                  onClick={handleAiGenerate}
                  disabled={aiLoading}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2l1.9 5.7L19.6 9.5 13.9 11.4 12 17l-1.9-5.6L4.4 9.5l5.7-1.8L12 2z"/>
                    <path d="M19 14l.8 2.4L22 17l-2.2.7L19 20l-.7-2.3L16 17l2.3-.6L19 14z"/>
                  </svg>
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
              <span className="sa-char-count">
                {newEvt.description.length} / {DESC_MAX}
              </span>
            </div>

            <button type="submit" className="sa-submit-btn" disabled={creating}>
              {creating ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Publicar Evento'}
            </button>
          </form>
        </div>

        <BottomNav />
        {scanPortal}
        {modal && <StaffModal {...modal} onCancel={() => setModal(null)} />}
        {toast && <StaffToast message={toast.message} type={toast.type} />}
      </div>
    )
  }

  // ── Attendees View ──
  const evPrice = Number(selectedEvent?.price) || 0
  const evCapacity = Number(selectedEvent?.capacity) || 0
  const recaudado = paidCount * evPrice
  const esperado = (evCapacity > 0 ? evCapacity : attendees.length) * evPrice
  const ringPct = evPrice > 0
    ? (esperado > 0 ? Math.round((recaudado / esperado) * 100) : 0)
    : (attendees.length > 0 ? Math.round((attendedCount / attendees.length) * 100) : 0)
  const ringLabel = evPrice > 0 ? 'recaudado' : 'asistencia'

  return (
    <div className="sa-root">
      <div className="sa-sticky-top">
        <div className="sa-top-gradient">
          <header className="sa-attendees-header">
            <button className="sa-back-btn" onClick={goBack}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div className="sa-header-titles">
              <span className="sa-h-title">{selectedEvent ? selectedEvent.name : 'Todos los Asistentes'}</span>
              <span className="sa-h-subtitle">
                {selectedEvent
                  ? `${selectedEvent.date || 'Sin fecha'}${selectedEvent.active === 0 || selectedEvent.active === '0' ? ' · Cerrado' : ''}`
                  : 'Registros globales del hotel'}
              </span>
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
            <div className="sa-stat-card sa-stat-card--total">
              <span className="sa-stat-num">{loading ? '…' : attendees.length}</span>
              <span className="sa-stat-label">Total</span>
            </div>
            <div className="sa-stat-card sa-stat-card--active">
              <span className="sa-stat-num">{loading ? '…' : paidCount}</span>
              <span className="sa-stat-label">Pagados</span>
            </div>
            <div className="sa-stat-card sa-stat-card--pending">
              <span className="sa-stat-num">{loading ? '…' : pendingCount}</span>
              <span className="sa-stat-label">Pendientes</span>
            </div>
          </div>
        </div>

        {selectedEvent && (
          <div className="sa-ingresos">
            <div className="sa-donut" style={{ '--pct': ringPct }}>
              <div className="sa-donut-hole">
                <span className="sa-donut-pct">{ringPct}%</span>
                <span className="sa-donut-cap">{ringLabel}</span>
              </div>
            </div>
            <div className="sa-ingresos-info">
              {evPrice > 0 ? (
                <div className="sa-ingresos-money">
                  <span className="sa-money-now">${recaudado.toLocaleString('es-MX')}</span>
                  <span className="sa-money-exp"> / ${esperado.toLocaleString('es-MX')}</span>
                </div>
              ) : (
                <div className="sa-ingresos-money"><span className="sa-money-now">Evento gratuito</span></div>
              )}
              <div className="sa-ingresos-legend">
                <span className="sa-leg"><i className="sa-leg-dot sa-leg-dot--paid" />Pagados {paidCount}</span>
                <span className="sa-leg"><i className="sa-leg-dot sa-leg-dot--pend" />Pend {pendingCount}</span>
                <span className="sa-leg"><i className="sa-leg-dot sa-leg-dot--att" />Asist {attendedCount}</span>
              </div>
              {evCapacity > 0 && (
                <span className="sa-ingresos-aforo">Aforo: {attendees.length}/{evCapacity}</span>
              )}
            </div>
          </div>
        )}

        <div className="sa-filter-bar">
          {/* Selector de evento */}
          <button
            className="sa-filter-chip sa-filter-chip--event"
            onClick={() => setShowEventPicker(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className="sa-chip-event-label">{selectedEvent ? selectedEvent.name : 'Todos los eventos'}</span>
          </button>

          {/* Selector de estado — un solo botón desplegable */}
          <button
            className={`sa-filter-chip sa-filter-chip--estado ${filter !== 'all' ? 'sa-filter-chip--active' : ''}`}
            onClick={() => setShowFilterPicker(true)}
          >
            {filter === 'all'      && <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>Todos</>}
            {filter === 'paid'     && <><span className="sa-chip-dot sa-chip-dot--paid" />Pagados <span className="sa-chip-count">{paidCount}</span></>}
            {filter === 'pending'  && <><span className="sa-chip-dot sa-chip-dot--pending" />Pendientes <span className="sa-chip-count">{pendingCount}</span></>}
            {filter === 'attended' && <><span className="sa-chip-dot sa-chip-dot--attended" />Asistieron <span className="sa-chip-count">{attendedCount}</span></>}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ marginLeft: 2 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
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

      {showFilterPicker && (
        <div className="sa-picker-overlay" onClick={() => setShowFilterPicker(false)}>
          <div className="sa-picker-sheet" onClick={e => e.stopPropagation()}>
            <div className="sa-picker-header">
              <span className="sa-picker-title">Filtrar por estado</span>
              <button className="sa-picker-close" onClick={() => setShowFilterPicker(false)}>✕</button>
            </div>
            <div className="sa-picker-list">
              {[
                { key: 'all',      label: 'Todos',       count: attendees.length, dot: null },
                { key: 'paid',     label: 'Pagados',     count: paidCount,        dot: 'sa-chip-dot--paid' },
                { key: 'pending',  label: 'Pendientes',  count: pendingCount,     dot: 'sa-chip-dot--pending' },
                { key: 'attended', label: 'Asistieron',  count: attendedCount,    dot: 'sa-chip-dot--attended' },
              ].map(({ key, label, count, dot }) => (
                <button
                  key={key}
                  className={`sa-picker-item ${filter === key ? 'sa-picker-item--sel' : ''}`}
                  onClick={() => { setFilter(key); setShowFilterPicker(false) }}
                >
                  <span className="sa-picker-item__left">
                    {dot && <span className={`sa-chip-dot ${dot}`} style={{ width: 9, height: 9 }} />}
                    {label}
                  </span>
                  <span className="sa-picker-item__right">
                    <span className="sa-picker-count">{count}</span>
                    {filter === key && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </span>
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
            {filteredAttendees.map((a, idx) => {
              const paid      = isPaid(a)
              const attended  = isCheckedIn(a)
              const transfer  = isTransfer(a)
              const dotClass  = attended ? 'sa-dot--attended'
                : paid      ? 'sa-dot--paid'
                : transfer  ? 'sa-dot--transfer'
                :             'sa-dot--unpaid'
              return (
                <div
                  key={a.id}
                  className="sa-attendee-card"
                  style={{ animationDelay: `${idx * 0.03}s` }}
                  onClick={() => navigate(`/checkin?rid=${a.id}&eid=${selectedEvent?.id}`)}
                >
                  {/* Fila principal: siempre presente */}
                  <div className="sa-att-main">
                    <div className={`sa-att-icon-box ${
                      attended ? 'sa-att-icon-box--attended' :
                      paid     ? 'sa-att-icon-box--paid' :
                      transfer ? 'sa-att-icon-box--transfer' : 'sa-att-icon-box--unpaid'
                    }`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>

                    <div className="sa-att-info">
                      <span className="sa-att-name">{a.full_name}</span>
                      <span className="sa-att-phone">{a.phone}</span>
                    </div>

                    <div className="sa-att-status-side">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {attended ? (
                          <span className="sa-tag sa-tag--attended">Asistió</span>
                        ) : paid ? (
                          <span className="sa-tag sa-tag--paid">{transfer ? 'Pago OK' : 'Pagado'}</span>
                        ) : transfer ? (
                          <span className={`sa-tag ${a.transfer_proof_url ? 'sa-tag--paid' : 'sa-tag--transfer'}`}>
                            {a.transfer_proof_url ? 'Con comprobante' : 'Transferencia'}
                          </span>
                        ) : (
                          <span className="sa-tag sa-tag--unpaid">Presencial</span>
                        )}
                        
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bdc3c7" strokeWidth="3">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Fila de acción: solo si no ha pagado y no ha asistido */}
                  {!paid && !attended && (
                    <div className="sa-att-action-row">
                      {transfer && a.transfer_proof_url && (
                        <a
                          className="sa-proof-thumb"
                          href={a.transfer_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          title="Ver comprobante"
                        >
                          <img src={a.transfer_proof_url} alt="comprobante" />
                        </a>
                      )}
                      <button
                        className={`sa-confirm-pay-btn${!transfer ? ' sa-confirm-pay-btn--presencial' : ''}`}
                        disabled={transfer ? confirmingPaymentId === a.id : confirmingPresencialId === a.id}
                        onClick={e => {
                          e.stopPropagation()
                          transfer ? handleConfirmPayment(a.id) : handleConfirmPresencial(a.id)
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {transfer
                          ? (confirmingPaymentId === a.id ? 'Confirmando...' : 'Confirmar pago')
                          : (confirmingPresencialId === a.id ? 'Confirmando...' : 'Cobrar y confirmar')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
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

      {showEditionPicker && (
        <div className="sa-picker-overlay" onClick={() => setShowEditionPicker(null)}>
          <div className="sa-picker-sheet" onClick={e => e.stopPropagation()}>
            <div className="sa-picker-header">
              <span className="sa-picker-title">Nueva edición</span>
              <span className="sa-picker-subtitle">{showEditionPicker.name}</span>
            </div>
            <button className="sa-edition-opt sa-edition-opt--primary" onClick={() => handleRenovarIgual(showEditionPicker)}>
              <div className="sa-edition-opt-icon sa-edition-opt-icon--green">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
              </div>
              <div className="sa-edition-opt-body">
                <span className="sa-edition-opt-title">Renovar igual</span>
                <span className="sa-edition-opt-sub">
                  {allRegs.filter(r => String(r.event_id) === String(showEditionPicker.id)).length} participantes copiados · siguiente semana
                </span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button className="sa-edition-opt" onClick={() => handlePersonalizar(showEditionPicker)}>
              <div className="sa-edition-opt-icon sa-edition-opt-icon--olive">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <div className="sa-edition-opt-body">
                <span className="sa-edition-opt-title">Personalizar</span>
                <span className="sa-edition-opt-sub">Editar detalles antes de publicar</span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <BottomNav />
      {scanPortal}
      {modal && <StaffModal {...modal} onCancel={() => setModal(null)} />}
      {toast && <StaffToast message={toast.message} type={toast.type} />}
    </div>
  )
}

// ── In-app Modal ──────────────────────────────────────────
function StaffModal({ icon, title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const iconEl = icon === 'delete' ? (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
    </svg>
  ) : icon === 'lock' ? (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ) : (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )

  return (
    <div className="sa-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="sa-modal-sheet">
        <div className={`sa-modal-icon-wrap ${danger ? 'sa-modal-icon-wrap--danger' : 'sa-modal-icon-wrap--warn'}`}>
          {iconEl}
        </div>
        <h3 className="sa-modal-title">{title}</h3>
        <p className="sa-modal-msg">{message}</p>
        <div className="sa-modal-actions">
          <button className="sa-modal-btn sa-modal-btn--cancel" onClick={onCancel}>Cancelar</button>
          <button className={`sa-modal-btn ${danger ? 'sa-modal-btn--danger' : 'sa-modal-btn--confirm'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toast notification ────────────────────────────────────
function StaffToast({ message, type }) {
  const icon = type === 'error'
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    : type === 'info'
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
  return (
    <div className={`sa-toast sa-toast--${type ?? 'success'}`}>
      <span className="sa-toast-icon">{icon}</span>
      <span className="sa-toast-msg">{message}</span>
    </div>
  )
}
