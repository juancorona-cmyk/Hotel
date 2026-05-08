import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getRegistrationById, checkInRegistration, undoCheckInRegistration, adminLogin, adminHasUsers } from '../lib/turso'
import './CheckInPage.css'

const SETUP_KEY = import.meta.env.VITE_ADMIN_SETUP_KEY || null
const isNativeApp = !!window.Capacitor

export default function CheckInPage() {
  const [searchParams] = useSearchParams()
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

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginUser.trim() || !loginPwd) return
    setLoginBusy(true); setLoginErr('')
    try {
      const hasUsers = await adminHasUsers()
      let ok = false
      let result = null
      if (!hasUsers) {
        if (SETUP_KEY && loginPwd === SETUP_KEY) ok = true
        else setLoginErr('DB vacía y clave incorrecta')
      } else {
        result = await adminLogin(loginUser.trim(), loginPwd)
        if (result && result.ok) ok = true
        else setLoginErr('Usuario o contraseña incorrectos')
      }
      if (ok) {
        localStorage.setItem('ci_authed', 'true')
        localStorage.setItem('ci_role', (hasUsers && result) ? result.role : 'admin')
        localStorage.setItem('ci_perms', JSON.stringify((hasUsers && result) ? result.permissions : null))
        setAuthed(true)
      }
    } catch (err) {
      setLoginErr(`Error: ${err.message}`)
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
      <div className="ci-page">
        <div className="ci-card ci-login-card">
          <div className="ci-login-header">
            <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ci-login-logo" />
            <div className="ci-login-badge">STAFF</div>
          </div>
          <h2 className="ci-login-title">Validación de Tickets</h2>
          <p className="ci-login-sub">Ingresa tus credenciales para gestionar accesos</p>
          <form onSubmit={handleLogin} className="ci-login-form">
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
                autoFocus
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
              />
              <button type="button" className="ci-pwd-toggle" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}>
                {showPwd ? 'Ocultar' : 'Ver'}
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
            <button type="submit" className="ci-login-btn" disabled={loginBusy}>
              {loginBusy ? (
                <span className="ci-login-btn-spinner" />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  Entrar
                </>
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

  if (!rid || !reg) {
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
          <h2 className="ci-empty-title">{!rid ? 'Listo para escanear' : 'Entrada no encontrada'}</h2>
          <p className="ci-empty-text">
            {!rid
              ? 'Escanea un código QR para validar la asistencia de un invitado.'
              : 'El ticket escaneado no existe o es inválido.'}
          </p>
          <button className="ci-logout-link" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>
    )
  }

  const isCheckedIn = reg.checked_in === 1 || reg.checked_in === '1'

  return (
    <div className="ci-page">
      <div className={`ci-card ci-card--result ${isCheckedIn ? 'ci-card--done' : ''}`}>
        <div className="ci-header-row">
          <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ci-logo-sm" />
          <button className="ci-logout-btn" onClick={handleLogout} title="Cerrar sesión">Salir</button>
        </div>

        <div className="ci-body">
          <div className={`ci-result-badge ${isCheckedIn ? 'ci-result-badge--ok' : 'ci-result-badge--pending'}`}>
            {isCheckedIn ? (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>YA CONFIRMADO</span>
              </>
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>PENDIENTE DE ENTRADA</span>
              </>
            )}
          </div>

          <div className="ci-info">
            <div className="ci-info__row ci-info__row--name">
              <span className="ci-info__label">Persona</span>
              <span className="ci-info__value ci-info__value--big">{reg.full_name}</span>
            </div>
            <div className="ci-info__row">
              <span className="ci-info__label">Evento</span>
              <span className="ci-info__value">{reg.event_name || reg.activity_name || '—'}</span>
            </div>
            <div className="ci-info__row">
              <span className="ci-info__label">Ticket</span>
              <span className="ci-info__value ci-info__value--id">#{String(reg.id).padStart(4, '0')}</span>
            </div>
            <div className="ci-info__row">
              <span className="ci-info__label">Teléfono</span>
              <span className="ci-info__value">{reg.phone}</span>
            </div>
            <div className="ci-info__row">
              <span className="ci-info__label">Estado de pago</span>
              <span className={`ci-info__value ci-pay-status ${reg.paid ? 'ci-pay--ok' : 'ci-pay--pending'}`}>
                {reg.paid ? 'PAGADO' : 'PENDIENTE DE PAGO'}
              </span>
            </div>
            <div className="ci-info__row">
              <span className="ci-info__label">Registrado</span>
              <span className="ci-info__value ci-info__value--date">
                {String(reg.created_at || '').slice(0, 16).replace('T', ' · ')}
              </span>
            </div>
            {isCheckedIn && reg.checked_in_at && (
              <div className="ci-info__row ci-info__row--check">
                <span className="ci-info__label">Entrada confirmada</span>
                <span className="ci-info__value ci-info__value--date">
                  {String(reg.checked_in_at).slice(0, 16).replace('T', ' · ')}
                </span>
              </div>
            )}
          </div>

          {status === 'confirmed' && (
            <div className="ci-toast ci-toast--ok">Entrada confirmada exitosamente</div>
          )}
          {status === 'undone' && (
            <div className="ci-toast ci-toast--warn">Confirmación deshecha</div>
          )}
          {status === 'error' && (
            <div className="ci-toast ci-toast--err">Error. Intenta de nuevo.</div>
          )}

          <div className="ci-actions">
            {isCheckedIn ? (
              <button className="ci-btn ci-btn--undo" onClick={handleUndo} disabled={updating}>
                {updating ? 'Procesando...' : 'Deshacer confirmación'}
              </button>
            ) : (
              <button className="ci-btn ci-btn--confirm" onClick={handleCheckIn} disabled={updating}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {updating ? 'Confirmando...' : 'Confirmar entrada'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
