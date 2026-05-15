import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
import { getRegistrationById, checkInRegistration, undoCheckInRegistration, updateActivityRegistrationPayment, updateTransferProof, adminLoginSingle, API_BASE } from '../lib/turso'
import StaffApp from './StaffApp'
import './CheckInPage.css'

const SETUP_KEY = import.meta.env.VITE_ADMIN_SETUP_KEY || null
const isNativeApp = Capacitor.isNativePlatform()

export default function CheckInPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const rid = searchParams.get('rid')

  // Auth
  const [authed, setAuthed] = useState(() => localStorage.getItem('ci_authed') === 'true')
  const [loginUser, setLoginUser] = useState('')
  const [loginPwd, setLoginPwd] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const [reg, setReg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!isNativeApp && rid) {
      setLoading(true)
      getRegistrationById(parseInt(rid))
        .then(r => setReg(r))
        .catch(() => setReg(null))
        .finally(() => setLoading(false))
      return
    }
    if (!authed || !rid) { setLoading(false); return }
    setLoading(true)
    getRegistrationById(parseInt(rid))
      .then(r => setReg(r))
      .catch(() => setReg(null))
      .finally(() => setLoading(false))
  }, [rid, authed])

  // Lógica de Escaneo
  const startScan = async () => {
    if (!isNativeApp) {
      alert('El escaneo solo funciona en la aplicación instalada.')
      return
    }

    try {
      const { barcodes } = await BarcodeScanner.scan()
      if (barcodes.length > 0) {
        const value = barcodes[0].displayValue
        // Esperamos una URL como: https://hotelpuntagaleria.mx/checkin?rid=123
        try {
          const url = new URL(value)
          const scannedRid = url.searchParams.get('rid')
          if (scannedRid) {
            navigate(`/checkin?rid=${scannedRid}`)
          } else {
            alert('Código QR no válido para el sistema del hotel.')
          }
        } catch {
          // Si no es URL, probamos si es solo el ID
          if (!isNaN(value)) {
            navigate(`/checkin?rid=${value}`)
          } else {
            alert('Código QR no reconocido.')
          }
        }
      }
    } catch (err) {
      console.error('Scan error:', err)
      // Si falla por falta de permisos o no soportado
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginUser.trim() || !loginPwd) return
    setLoginBusy(true)
    setLoginErr('')
    try {
      const result = await adminLoginSingle(loginUser.trim(), loginPwd, SETUP_KEY)
      if (result.ok) {
        localStorage.setItem('ci_authed', 'true')
        localStorage.setItem('ci_role', result.role)
        localStorage.setItem('ci_perms', JSON.stringify(result.permissions ?? null))
        setAuthed(true)
      } else {
        setLoginErr(
          result.reason === 'setup'
            ? 'DB sin usuarios. Verifica la clave de configuración.'
            : 'Usuario o contraseña incorrectos'
        )
      }
    } catch (err) {
      setLoginErr(err.message || 'Error de conexión')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('ci_authed')
    localStorage.removeItem('ci_role')
    localStorage.removeItem('ci_perms')
    setAuthed(false)
    setReg(null)
    navigate('/checkin')
  }

  const handleMarkPaid = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await updateActivityRegistrationPayment(reg.id, true)
      setReg(r => ({ ...r, paid: 1 }))
      setStatus('paid')
      setTimeout(() => setStatus(''), 3000)
    } catch {
      setStatus('error')
    } finally {
      setUpdating(false)
    }
  }

  const handleMarkPaidAndCheckIn = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await updateActivityRegistrationPayment(reg.id, true)
      await checkInRegistration(reg.id)
      setReg(r => ({ ...r, paid: 1, checked_in: 1, checked_in_at: new Date().toISOString() }))
      setStatus('paid_confirmed')
      setTimeout(() => setStatus(''), 4000)
    } catch {
      setStatus('error')
    } finally {
      setUpdating(false)
      setConfirmingUnpaid(false)
    }
  }

  const handleCheckIn = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await checkInRegistration(reg.id)
      setReg(r => ({ ...r, checked_in: 1, checked_in_at: new Date().toISOString() }))
      setStatus('confirmed')
      setTimeout(() => setStatus(''), 3000)
    } catch {
      setStatus('error')
    } finally {
      setUpdating(false)
    }
  }

  const handleUndo = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await undoCheckInRegistration(reg.id)
      setReg(r => ({ ...r, checked_in: 0, checked_in_at: null }))
      setStatus('undone')
      setTimeout(() => setStatus(''), 3000)
    } catch {
      setStatus('error')
    } finally {
      setUpdating(false)
    }
  }

  const handleUploadProof = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !reg) return
    setUploading(true)
    try {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target.result)
        reader.readAsDataURL(file)
      })
      const res = await fetch(`${API_BASE}/.netlify/functions/upload-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, registrationId: reg.id }),
      })
      const data = await res.json()
      if (!data.url) throw new Error(data.error ?? 'Sin URL')
      await updateTransferProof(reg.id, data.url)
      setReg(r => ({ ...r, transfer_proof_url: data.url, paid: 1 }))
      setStatus('proof_uploaded')
      setTimeout(() => setStatus(''), 4000)
    } catch (err) {
      console.error(err)
      setStatus('error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── PUBLIC: Browser, no app installed ──
  if (!isNativeApp) {
    if (loading) {
      return (
        <div className="ci-page ci-page--public">
          <div className="ci-card ci-card--public">
            <div className="ci-public-spinner" />
            <p className="ci-public-loading">Verificando registro...</p>
          </div>
        </div>
      )
    }

    if (!rid || !reg) {
      return (
        <div className="ci-page ci-page--public">
          <div className="ci-card ci-card--public">
            <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ci-public-logo" />
            <div className="ci-public-icon">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
                <line x1="9" y1="15" x2="9.01" y2="15" />
                <line x1="15" y1="15" x2="15.01" y2="15" />
              </svg>
            </div>
            <h2 className="ci-public-title">
              {!rid ? 'Registro de asistencias' : 'Registro no encontrado'}
            </h2>
            <p className="ci-public-text">
              {!rid
                ? 'El staff del hotel confirmará tu asistencia al escanear tu código QR en la entrada del evento.'
                : 'No pudimos encontrar este registro. Por favor contacta al staff del hotel para verificar tu información.'}
            </p>
            <div className="ci-public-footer">
              <span>Hotel Punta Galería</span>
            </div>
          </div>
        </div>
      )
    }

    // Public ticket preview — minimal info, no sensitive data
    return (
      <div className="ci-page ci-page--public">
        <div className="ci-card ci-card--public">
          <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ci-public-logo" />
          <div className="ci-public-check">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 className="ci-public-title">¡Tu registro está confirmado!</h2>
          <div className="ci-public-details">
            <div className="ci-public-detail">
              <span className="ci-public-label">Asistente</span>
              <span className="ci-public-value">{reg.full_name}</span>
            </div>
            {reg.event_name && (
              <div className="ci-public-detail">
                <span className="ci-public-label">Evento</span>
                <span className="ci-public-value">{reg.event_name}</span>
              </div>
            )}
            <div className="ci-public-detail">
              <span className="ci-public-label">Ticket</span>
              <span className="ci-public-value ci-public-ticket">#{String(reg.id).padStart(4, '0')}</span>
            </div>
          </div>
          <div className="ci-public-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p>Presenta este código al staff en la entrada del evento para confirmar tu asistencia.</p>
          </div>
          <div className="ci-public-footer">
            <span>Hotel Punta Galería</span>
          </div>
        </div>
      </div>
    )

  }

  // ── NATIVE APP: Staff flow below ──

  if (!authed) {
    return (
      <div className="ci-page ci-page--login">
        <div className="ci-login-top">
          <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ci-login-logo" />
          <span className="ci-login-badge">STAFF</span>
        </div>
        <div className="ci-login-body">
          <h2 className="ci-login-title">Validación de Tickets</h2>
          <p className="ci-login-sub">Ingresa tus credenciales para gestionar accesos</p>
          <form onSubmit={handleLogin} className="ci-login-form">
            <div className="ci-login-fields">
              <div className="ci-login-field">
                <svg className="ci-login-field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  value={loginUser}
                  onChange={e => { setLoginUser(e.target.value); setLoginErr('') }}
                  placeholder="Usuario"
                  className="ci-login-input"
                  autoComplete="username"
                />
              </div>
              <div className="ci-login-field">
                <svg className="ci-login-field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={loginPwd}
                  onChange={e => { setLoginPwd(e.target.value); setLoginErr('') }}
                  placeholder="Contraseña"
                  className="ci-login-input ci-login-input--pwd"
                  autoComplete="current-password"
                />
                <button type="button" className="ci-pwd-toggle" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}>
                  {showPwd ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {loginErr && (
                <div className="ci-login-err">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  {loginErr}
                </div>
              )}
            </div>
            <button type="submit" className="ci-login-btn" disabled={loginBusy}>
              {loginBusy ? (
                <span className="ci-login-btn-spinner" />
              ) : (
                <>Entrar</>
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="ci-page">
        <div className="ci-card">
          <div className="ci-loading-wrap">
            <div className="ci-loading-spinner" />
            <p className="ci-loading-text">Verificando entrada...</p>
          </div>
        </div>
      </div>
    )
  }

  // No QR scanned → show staff panel with events & attendees
  if (!rid) {
    return <StaffApp onStartScan={startScan} onLogout={handleLogout} />
  }

  // QR scanned but registration not found
  if (!reg) {
    return (
      <div className="ci-page">
        <div className="ci-card ci-card--empty">
          <div className="ci-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
              <line x1="9" y1="15" x2="9.01" y2="15" />
              <line x1="15" y1="15" x2="15.01" y2="15" />
            </svg>
          </div>
          <h2 className="ci-empty-title">Entrada no encontrada</h2>
          <p className="ci-empty-text">El ticket escaneado no existe o es inválido.</p>
          <div className="ci-actions">
            <button className="ci-btn ci-btn--undo" onClick={() => navigate('/checkin')}>Volver al Panel</button>
          </div>
          <button className="ci-logout-link" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>
    )
  }

  const isCheckedIn = reg.checked_in === 1 || reg.checked_in === '1'
  const isPaid = reg.paid === 1 || reg.paid === '1'
  const isTransfer = (reg.payment_method || '').toLowerCase().includes('transfer')
  const scanState = isCheckedIn
    ? 'duplicate'
    : isPaid
      ? 'ready'
      : isTransfer ? 'unpaid_transfer' : 'unpaid_cash'

  const eid = searchParams.get('eid')
  const goBackToApp = () => navigate(eid ? `/checkin?eid=${eid}` : '/checkin')

  const heroClass = scanState === 'duplicate'
    ? 'ci-result-hero--duplicate'
    : (scanState === 'unpaid_transfer' || scanState === 'unpaid_cash')
      ? 'ci-result-hero--unpaid'
      : ''

  // Formatea fecha a "15 may · 7:40 p.m."
  const fmtDate = (raw) => {
    if (!raw) return '—'
    const d = new Date(String(raw).includes('T') || String(raw).includes('Z') ? raw : raw + 'Z')
    if (isNaN(d)) return String(raw).slice(0, 16).replace('T', ' ')
    const fecha = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    const hora  = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${fecha} · ${hora}`
  }

  // Iniciales del nombre para el avatar
  const initials = (reg.full_name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className="ci-result-root">
      <div className={`ci-result-hero ${heroClass}`}>
        <div className="ci-result-topbar">
          <button className="ci-result-back" onClick={goBackToApp}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button className="ci-result-exit" onClick={handleLogout}>Salir</button>
        </div>

        <div className="ci-result-hero-body">
          {/* Avatar con iniciales */}
          <div className="ci-result-avatar">{initials}</div>

          <div className="ci-result-hero-info">
            {/* Badge de estado */}
            {scanState === 'duplicate' && (
              <div className="ci-result-status-pill ci-result-status-pill--duplicate">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Ya ingresó
              </div>
            )}
            {scanState === 'ready' && (
              <div className="ci-result-status-pill ci-result-status-pill--ok">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Listo para entrar
              </div>
            )}
            {scanState === 'unpaid_transfer' && (
              <div className="ci-result-status-pill ci-result-status-pill--warn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Verifica transferencia
              </div>
            )}
            {scanState === 'unpaid_cash' && (
              <div className="ci-result-status-pill ci-result-status-pill--warn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
                Cobro pendiente
              </div>
            )}

            <h1 className="ci-result-name">{reg.full_name}</h1>
            <div className="ci-result-event-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".7">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="ci-result-event">{reg.event_name || reg.activity_name || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket strip */}
      <div className="ci-ticket-strip">
        <div className="ci-ticket-strip-left">
          <span className="ci-ticket-label">TICKET</span>
          <span className="ci-ticket-num">#{String(reg.id).padStart(4, '0')}</span>
        </div>
        <div className="ci-ticket-strip-right">
          <span className="ci-ticket-label">EVENTO</span>
          <span className="ci-ticket-event-name">{reg.event_name || reg.activity_name || '—'}</span>
        </div>
      </div>

      {/* Comprobante de transferencia */}
      {scanState === 'unpaid_transfer' && (
        reg.transfer_proof_url ? (
          <div className="ci-proof-section">
            <div className="ci-proof-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Comprobante adjunto
            </div>
            <a href={reg.transfer_proof_url} target="_blank" rel="noopener noreferrer" className="ci-proof-img-wrap">
              <img src={reg.transfer_proof_url} alt="Comprobante de transferencia" className="ci-proof-img" />
              <span className="ci-proof-img-hint">Toca para ampliar</span>
            </a>
          </div>
        ) : (
          <div className="ci-transfer-notice">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <div>
              <span className="ci-transfer-notice__title">Sin comprobante adjunto</span>
              <span className="ci-transfer-notice__sub">Sube la foto del comprobante o verifica manualmente</span>
            </div>
          </div>
        )
      )}

      {/* Detalles */}
      <div className="ci-result-body">
        <div className="ci-result-row">
          <div className="ci-result-icon ci-result-icon--phone">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <div className="ci-result-row-info">
            <span className="ci-result-row-label">Teléfono</span>
            <span className="ci-result-row-value">{reg.phone}</span>
          </div>
        </div>

        <div className="ci-result-row">
          <div className={`ci-result-icon ${isPaid ? 'ci-result-icon--paid' : 'ci-result-icon--unpaid'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <div className="ci-result-row-info">
            <span className="ci-result-row-label">Método de pago</span>
            <span className={`ci-result-row-value ci-result-row-value--tag ${isPaid ? 'ci-tag--paid' : 'ci-tag--unpaid'}`}>
              {isPaid
                ? `✓ Pagado${reg.payment_method ? ` · ${reg.payment_method}` : ''}`
                : reg.payment_method
                  ? `Pendiente · ${reg.payment_method}`
                  : 'Sin pago registrado'}
            </span>
          </div>
        </div>

        {isCheckedIn && reg.checked_in_at && (
          <div className="ci-result-row">
            <div className="ci-result-icon ci-result-icon--date">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="ci-result-row-info">
              <span className="ci-result-row-label">Hora de entrada</span>
              <span className="ci-result-row-value">{fmtDate(reg.checked_in_at)}</span>
            </div>
          </div>
        )}

        <div className="ci-result-row">
          <div className="ci-result-icon ci-result-icon--date">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="ci-result-row-info">
            <span className="ci-result-row-label">Registrado</span>
            <span className="ci-result-row-value">{fmtDate(reg.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {status === 'paid_confirmed' && <div className="ci-toast ci-toast--ok">✓ Pago registrado · Entrada confirmada</div>}
      {status === 'confirmed' && <div className="ci-toast ci-toast--ok">✓ Entrada confirmada</div>}
      {status === 'undone' && <div className="ci-toast ci-toast--warn">Confirmación deshecha</div>}
      {status === 'proof_uploaded' && <div className="ci-toast ci-toast--ok">✓ Comprobante subido · Pago marcado</div>}
      {status === 'error' && <div className="ci-toast ci-toast--warn">Error al procesar. Intenta de nuevo.</div>}

      {/* Footer de acciones */}
      <div className="ci-result-footer">
        {scanState === 'duplicate' && (
          <button className="ci-btn-action ci-btn-action--undo" onClick={handleUndo} disabled={updating}>
            {updating ? 'Procesando...' : 'Deshacer confirmación'}
          </button>
        )}

        {scanState === 'ready' && (
          <button className="ci-btn-action ci-btn-action--confirm" onClick={handleCheckIn} disabled={updating}>
            {updating ? <span className="ci-login-btn-spinner" /> : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Confirmar entrada
              </>
            )}
          </button>
        )}

        {scanState === 'unpaid_transfer' && (
          <div className="ci-transfer-actions">
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={handleUploadProof}
              style={{ display: 'none' }}
            />
            {!reg.transfer_proof_url && (
              <button
                className="ci-btn-action ci-btn-action--upload"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || updating}
              >
                {uploading ? <span className="ci-login-btn-spinner" /> : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Subir comprobante
                  </>
                )}
              </button>
            )}
            <button className="ci-btn-action ci-btn-action--confirm" onClick={handleMarkPaidAndCheckIn} disabled={updating || uploading}>
              {updating ? <span className="ci-login-btn-spinner" /> : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {reg.transfer_proof_url ? 'Comprobante verificado · Confirmar entrada' : 'Verificar y confirmar entrada'}
                </>
              )}
            </button>
          </div>
        )}

        {scanState === 'unpaid_cash' && (
          <button className="ci-btn-action ci-btn-action--confirm" onClick={handleMarkPaidAndCheckIn} disabled={updating}>
            {updating ? <span className="ci-login-btn-spinner" /> : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Cobrar y confirmar entrada
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}


