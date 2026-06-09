import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
import { QRCodeSVG } from 'qrcode.react'
import { getRegistrationById, checkInRegistration, undoCheckInRegistration, updateActivityRegistrationPayment, updateTransferProof, adminLoginSingle, adminForceChangePassword, API_BASE, checkWhatsappMember, addWhatsappMember } from '../lib/turso'
import { checkPasswordStrength } from '../lib/passwordStrength'
import { subscribeToPush } from '../lib/pushNotifications'
import { CDN } from '../lib/cdn'
import { fmtFecha } from '../lib/utils'
import StaffApp from './StaffApp'
import './CheckInPage.css'

function decodeJWT(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch { return null }
}
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
  // Cambio forzado de contraseña (clave generica → nueva)
  const [mustChange, setMustChange] = useState(false)
  const [chgPwd, setChgPwd] = useState('')
  const [chgPwd2, setChgPwd2] = useState('')
  const [chgErr, setChgErr] = useState('')
  const [chgBusy, setChgBusy] = useState(false)
  // Recuperar contraseña
  const [showRecover, setShowRecover] = useState(false)
  const [recUser, setRecUser] = useState('')
  const [recKey, setRecKey] = useState('')
  const [recPwd, setRecPwd] = useState('')
  const [recBusy, setRecBusy] = useState(false)
  const [recErr, setRecErr] = useState('')
  const [recOk, setRecOk] = useState(false)

  // Suscribir a push cada vez que el staff está autenticado
  useEffect(() => {
    if (authed && isNativeApp) subscribeToPush().catch(() => {})
  }, [authed])

  const [reg, setReg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isWhatsappMember, setIsWhatsappMember] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!isNativeApp && rid) {
      setLoading(true)
      getRegistrationById(parseInt(rid))
        .then(async r => {
          setReg(r)
          if (r?.phone) {
            const isMember = await checkWhatsappMember(r.phone)
            setIsWhatsappMember(isMember)
          }
        })
        .catch(() => setReg(null))
        .finally(() => setLoading(false))
      return
    }
    if (!authed || !rid) { setLoading(false); return }
    setLoading(true)
    getRegistrationById(parseInt(rid))
      .then(async r => {
        setReg(r)
        if (r?.phone) {
          const isMember = await checkWhatsappMember(r.phone)
          setIsWhatsappMember(isMember)
        }
      })
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
      const result = await adminLoginSingle(loginUser.trim(), loginPwd)
      if (result.ok && result.token) {
        const payload = decodeJWT(result.token)
        localStorage.setItem('ci_authed', 'true')
        localStorage.setItem('ci_token', result.token)
        localStorage.setItem('ci_role', payload?.role ?? 'staff')
        localStorage.setItem('ci_perms', JSON.stringify(payload?.permissions ?? null))
        setAuthed(true)
        subscribeToPush().catch(() => {})
      } else if (result.reason === 'must_change') {
        // Clave generica: pasar a pantalla de nueva contraseña
        setMustChange(true)
        setChgPwd(''); setChgPwd2(''); setChgErr('')
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

  const handleForceChange = async (e) => {
    e.preventDefault()
    setChgErr('')
    const chk = checkPasswordStrength(chgPwd)
    if (!chk.ok) { setChgErr(chk.message); return }
    if (chgPwd !== chgPwd2) { setChgErr('Las contraseñas no coinciden'); return }
    if (chgPwd === loginPwd) { setChgErr('Debe ser distinta a la genérica'); return }
    setChgBusy(true)
    try {
      const result = await adminForceChangePassword(loginUser.trim(), loginPwd, chgPwd)
      if (result.ok && result.token) {
        const payload = decodeJWT(result.token)
        localStorage.setItem('ci_authed', 'true')
        localStorage.setItem('ci_token', result.token)
        localStorage.setItem('ci_role', payload?.role ?? 'staff')
        localStorage.setItem('ci_perms', JSON.stringify(payload?.permissions ?? null))
        setMustChange(false)
        setLoginPwd('')
        setAuthed(true)
        subscribeToPush().catch(() => {})
      } else {
        setChgErr(result.error || 'No se pudo actualizar')
      }
    } catch (err) {
      setChgErr(err.message || 'Error de conexión')
    } finally {
      setChgBusy(false)
    }
  }

  const handleRecover = async (e) => {
    e.preventDefault()
    setRecErr('')
    if (!recUser.trim()) { setRecErr('Ingresa el usuario'); return }
    if (!recKey.trim()) { setRecErr('Ingresa la clave de recuperación'); return }
    const chk = checkPasswordStrength(recPwd.trim())
    if (!chk.ok) { setRecErr(chk.message); return }
    setRecBusy(true)
    try {
      const path = '/.netlify/functions/auth'
      const res = await fetch(API_BASE ? `${API_BASE}${path}` : path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', username: recUser.trim(), setupKey: recKey.trim(), newPassword: recPwd.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        setRecOk(true)
        setRecPwd(''); setRecKey('')
      } else {
        setRecErr(data.error || 'No se pudo actualizar')
      }
    } catch {
      setRecErr('Error de conexión')
    } finally {
      setRecBusy(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('ci_authed')
    localStorage.removeItem('ci_token')
    localStorage.removeItem('ci_role')
    localStorage.removeItem('ci_perms')
    setAuthed(false)
    setReg(null)
    navigate('/checkin')
  }

  const handleJoinGroup = async () => {
    if (reg?.phone) await addWhatsappMember(reg.phone).catch(() => {})
    window.open('https://chat.whatsapp.com/GVefjT90VZRJZ9X18Vizaw', '_blank', 'noopener')
  }

  const handleMarkPaid = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await updateActivityRegistrationPayment(reg.id, true)
      setReg(r => ({ ...r, paid: 1 }))
      setStatus('paid')
    } catch {
      setStatus('error')
      setTimeout(() => setStatus(''), 3000)
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
    } catch {
      setStatus('error')
      setTimeout(() => setStatus(''), 3000)
    } finally {
      setUpdating(false)
    }
  }

  const handleCheckIn = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await checkInRegistration(reg.id)
      setReg(r => ({ ...r, checked_in: 1, checked_in_at: new Date().toISOString() }))
      setStatus('confirmed')
    } catch {
      setStatus('error')
      setTimeout(() => setStatus(''), 3000)
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

    // Public ticket view — welcome screen after scanning QR
    const pubPaid = reg.paid === 1 || reg.paid === '1'
    const pubPayLabel = reg.payment_method === 'transferencia'
      ? (pubPaid ? 'Transferencia · Pagado ✓' : 'Transferencia · Pendiente')
      : reg.payment_method === 'presencial'
        ? 'Presencial · Pagar en recepción'
        : null

    return (
      <div className="ci-pub2-page">

        {/* ── Header verde ── */}
        <div className="ci-pub2-header">
          <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ci-pub2-logo" />
          <div className="ci-pub2-check">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="ci-pub2-heading">¡Gracias por tu registro!</h1>
          <p className="ci-pub2-subheading">Te esperamos en el evento · Hotel Punta Galería</p>
        </div>

        <div className="ci-pub2-body">

          {/* ── Evento ── */}
          {(reg.event_name || reg.event_description) && (
            <div className="ci-pub2-event-card">
              <span className="ci-pub2-section-label">Sobre el evento</span>
              {reg.event_name && <span className="ci-pub2-event-name">{reg.event_name}</span>}
              {reg.event_description && <p className="ci-pub2-event-desc">{reg.event_description}</p>}
            </div>
          )}

          {/* ── QR ── */}
          <div className="ci-pub2-qr-wrap">
            <div className="ci-pub2-qr-hint">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/>
                <line x1="16" y1="16" x2="16" y2="21"/><line x1="16" y1="16" x2="21" y2="16"/>
              </svg>
              Presenta este QR al personal en la entrada
            </div>
            <div className="ci-pub2-qr-frame">
              <QRCodeSVG
                value={`https://hotelpuntagaleria.mx/checkin?rid=${reg.id}`}
                size={190}
                level="H"
                includeMargin={false}
              />
            </div>
            <span className="ci-pub2-qr-label">TICKET #{String(reg.id).padStart(4, '0')}</span>
          </div>

          {/* ── Datos del asistente ── */}
          <div className="ci-pub2-info-card">
            <span className="ci-pub2-section-label">Datos del registro</span>

            <div className="ci-pub2-row">
              <span className="ci-pub2-row-key">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Asistente
              </span>
              <span className="ci-pub2-row-val">{reg.full_name}</span>
            </div>

            <div className="ci-pub2-row">
              <span className="ci-pub2-row-key">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a2 2 0 0 1 0-4V3h20v2a2 2 0 0 1 0 4v2a2 2 0 0 1 0 4v2H2v-2a2 2 0 0 1 0-4V9z"/><line x1="9" y1="3" x2="9" y2="21" strokeDasharray="3 3"/></svg>
                Ticket
              </span>
              <span className="ci-pub2-row-val">#{String(reg.id).padStart(4, '0')}</span>
            </div>

            {reg.event_date && (
              <div className="ci-pub2-row">
                <span className="ci-pub2-row-key">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Fecha
                </span>
                <span className="ci-pub2-row-val">{fmtFecha(reg.event_date, true)}</span>
              </div>
            )}

            <div className="ci-pub2-row">
              <span className="ci-pub2-row-key">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                Lugar
              </span>
              <span className="ci-pub2-row-val">Hotel Punta Galería, Morelia</span>
            </div>

            {reg.event_price != null && (
              <div className="ci-pub2-row">
                <span className="ci-pub2-row-key">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2m-3-7h4.5a1.5 1.5 0 0 1 0 3H9a1.5 1.5 0 0 0 0 3H14"/></svg>
                  Precio
                </span>
                <span className="ci-pub2-row-val ci-pub2-row-val--green">
                  {reg.event_price === 0 ? 'Gratuito' : `$${Number(reg.event_price).toLocaleString('es-MX')} MXN`}
                </span>
              </div>
            )}

            {pubPayLabel && (
              <div className="ci-pub2-row">
                <span className="ci-pub2-row-key">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  Pago
                </span>
                <span className={`ci-pub2-row-val ${pubPaid ? 'ci-pub2-row-val--green' : reg.payment_method === 'presencial' ? 'ci-pub2-row-val--blue' : 'ci-pub2-row-val--amber'}`}>
                  {pubPayLabel}
                </span>
              </div>
            )}
          </div>

          {/* ── WhatsApp Group CTA ── */}
          {isWhatsappMember === false && (
            <div className="ci-pub2-wa-card">
              <div className="ci-pub2-wa-info">
                <strong>¿Quieres unirte al grupo de WhatsApp?</strong>
                <span>Entérate de cambios de horario, avisos y próximos eventos.</span>
              </div>
              <button className="ci-pub2-wa-btn" onClick={handleJoinGroup}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Unirme al grupo
              </button>
            </div>
          )}

          {isWhatsappMember === true && (
            <div className="ci-pub2-wa-member">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Ya eres miembro del grupo de WhatsApp ✓
            </div>
          )}

          {/* ── Footer ── */}
          <div className="ci-pub2-footer">
            <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ci-pub2-footer-logo" />
            <span className="ci-pub2-footer-text">hotelpuntagaleria.mx</span>
          </div>
        </div>
      </div>
    )

  }

  // ── NATIVE APP: Staff flow below ──

  // Clave generica: forzar nueva contraseña antes de entrar
  if (mustChange) {
    const s = chgPwd ? checkPasswordStrength(chgPwd) : null
    return (
      <div className="ci-page ci-page--login">
        <div className="ci-login-top">
          <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ci-login-logo" />
          <span className="ci-login-badge">STAFF</span>
        </div>
        <div className="ci-login-body">
          <h2 className="ci-login-title">Crea tu contraseña</h2>
          <p className="ci-login-sub">Primer ingreso. Define una contraseña personal.</p>
          <form onSubmit={handleForceChange} className="ci-login-form">
            <div className="ci-login-fields">
              <div className="ci-login-field">
                <svg className="ci-login-field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={chgPwd}
                  onChange={e => { setChgPwd(e.target.value); setChgErr('') }}
                  placeholder="Nueva contraseña"
                  className="ci-login-input ci-login-input--pwd"
                  autoComplete="new-password"
                />
                <button type="button" className="ci-pwd-toggle" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}>
                  {showPwd ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {s && (
                <div className="ci-pwd-meter">
                  <div className="ci-pwd-meter-track">
                    <div className={`ci-pwd-meter-fill ci-pwd-meter-fill--${s.score}`} style={{ width: `${(s.score / 4) * 100}%` }} />
                  </div>
                  <span className={s.ok ? 'ci-pwd-meter-ok' : 'ci-pwd-meter-bad'}>{s.message}</span>
                </div>
              )}
              <div className="ci-login-field">
                <svg className="ci-login-field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={chgPwd2}
                  onChange={e => { setChgPwd2(e.target.value); setChgErr('') }}
                  placeholder="Repite la contraseña"
                  className="ci-login-input ci-login-input--pwd"
                  autoComplete="new-password"
                />
              </div>
              <p className="ci-login-sub" style={{ fontSize: 12, margin: 0 }}>Mínimo 8 caracteres, con letras y números. Sin espacios.</p>
              {chgErr && (
                <div className="ci-login-err">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {chgErr}
                </div>
              )}
            </div>
            <button type="submit" className="ci-login-btn" disabled={chgBusy}>
              {chgBusy ? <span className="ci-login-btn-spinner" /> : <>Guardar y entrar</>}
            </button>
          </form>
        </div>
      </div>
    )
  }

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

          <button type="button" className="ci-forgot-link" onClick={() => { setShowRecover(true); setRecErr(''); setRecOk(false) }}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {showRecover && (
          <div className="ci-recover-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRecover(false) }}>
            <form onSubmit={handleRecover} className="ci-recover-modal">
              <button type="button" className="ci-recover-x" onClick={() => setShowRecover(false)} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              {recOk ? (
                <div className="ci-recover-ok">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <p>Contraseña actualizada. Ya puedes iniciar sesión.</p>
                  <button type="button" className="ci-login-btn" onClick={() => setShowRecover(false)}>Entendido</button>
                </div>
              ) : (
                <>
                  <p className="ci-recover-title">Recuperar contraseña</p>
                  <p className="ci-recover-hint">Necesitas la clave de recuperación del administrador.</p>
                  <input className="ci-login-input" placeholder="Usuario" value={recUser} onChange={e => { setRecUser(e.target.value); setRecErr('') }} />
                  <input className="ci-login-input" placeholder="Clave de recuperación" value={recKey} onChange={e => { setRecKey(e.target.value); setRecErr('') }} />
                  <input className="ci-login-input" type="text" placeholder="Nueva contraseña" value={recPwd} onChange={e => { setRecPwd(e.target.value); setRecErr('') }} />
                  {recPwd && (() => {
                    const s = checkPasswordStrength(recPwd)
                    return (
                      <div className="ci-pwd-meter">
                        <div className="ci-pwd-meter-track">
                          <div className={`ci-pwd-meter-fill ci-pwd-meter-fill--${s.score}`} style={{ width: `${(s.score / 4) * 100}%` }} />
                        </div>
                        <span className={s.ok ? 'ci-pwd-meter-ok' : 'ci-pwd-meter-bad'}>{s.message}</span>
                      </div>
                    )
                  })()}
                  {recErr && <div className="ci-login-err"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>{recErr}</div>}
                  <button type="submit" className="ci-login-btn" disabled={recBusy}>
                    {recBusy ? <span className="ci-login-btn-spinner" /> : 'Restablecer contraseña'}
                  </button>
                </>
              )}
            </form>
          </div>
        )}
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

  const heroOverlay = scanState === 'duplicate'
    ? 'linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(15,23,42,0.95) 100%)'
    : (scanState === 'unpaid_transfer' || scanState === 'unpaid_cash')
    ? 'linear-gradient(180deg, rgba(69,26,3,0.7) 0%, rgba(69,26,3,0.95) 100%)'
    : 'linear-gradient(180deg, rgba(20,40,10,0.6) 0%, rgba(20,40,10,0.95) 100%)'

  const heroStyle = {
    backgroundImage: `${heroOverlay}, url(${CDN.FOTO_INICIO})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }

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
      <div className={`ci-result-hero ${heroClass}`} style={heroStyle}>
        <div className="ci-result-topbar">
          <button className="ci-result-back" onClick={goBackToApp} aria-label="Volver">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>

        <div className="ci-result-hero-body">
          {/* Avatar con iniciales */}
          <div className="ci-result-avatar">{initials}</div>

          <div className="ci-result-hero-info">
            {/* Badge de estado */}
            {scanState === 'duplicate' && (
              <div className="ci-result-status-pill ci-result-status-pill--duplicate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Asistió
              </div>
            )}
            {scanState === 'ready' && (
              <div className="ci-result-status-pill ci-result-status-pill--ok">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Pago Comprobado
              </div>
            )}
            {scanState === 'unpaid_transfer' && (
              <div className="ci-result-status-pill ci-result-status-pill--warn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
                Verifica transferencia
              </div>
            )}
            {scanState === 'unpaid_cash' && (
              <div className="ci-result-status-pill ci-result-status-pill--warn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Cobro pendiente
              </div>
            )}

            <h1 className="ci-result-name">{reg.full_name}</h1>
            <div className="ci-result-event-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".8">
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
        <div className="ci-proof-card">
          {reg.transfer_proof_url ? (
            <>
              <div className="ci-proof-card__icon ci-proof-card__icon--ok">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="ci-proof-card__info">
                <span className="ci-proof-card__title">Comprobante adjunto</span>
                <span className="ci-proof-card__sub">Transferencia registrada</span>
              </div>
              <a
                href={reg.transfer_proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ci-proof-card__btn"
                onClick={e => e.stopPropagation()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                Ver comprobante
              </a>
            </>
          ) : (
            <>
              <div className="ci-proof-card__icon ci-proof-card__icon--warn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <div className="ci-proof-card__info">
                <span className="ci-proof-card__title">Sin comprobante</span>
                <span className="ci-proof-card__sub">Sube la foto de la transferencia</span>
              </div>
              <input
                type="file"
                accept="image/*"
                ref={fileRef}
                onChange={handleUploadProof}
                style={{ display: 'none' }}
              />
              <button
                className="ci-proof-card__btn ci-proof-card__btn--upload"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <span className="ci-login-btn-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Subir comprobante
                  </>
                )}
              </button>
            </>
          )}
        </div>
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

      {/* Toasts menores */}
      {status === 'undone'         && <div className="ci-toast ci-toast--warn">Confirmación deshecha</div>}
      {status === 'proof_uploaded' && <div className="ci-toast ci-toast--ok">✓ Comprobante subido · Pago marcado</div>}
      {status === 'error'          && <div className="ci-toast ci-toast--warn">Error al procesar. Intenta de nuevo.</div>}

      {/* Overlay de éxito — transfer verificada o entrada confirmada */}
      {(status === 'paid' || status === 'confirmed' || status === 'paid_confirmed') && (
        <div className="ci-success-overlay" onClick={() => setStatus('')}>
          <div className="ci-success-sheet" onClick={e => e.stopPropagation()}>

            {/* Icono animado */}
            <div className={`ci-success-icon ${status === 'confirmed' || status === 'paid_confirmed' ? 'ci-success-icon--entry' : 'ci-success-icon--paid'}`}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" className="ci-check-path" />
              </svg>
            </div>

            {/* Título y subtítulo */}
            <h2 className="ci-success-title">
              {status === 'paid' ? 'Pago verificado' : 'Entrada confirmada'}
            </h2>
            <p className="ci-success-sub">
              {status === 'paid'
                ? 'Transferencia comprobada. Podrá ingresar el día del evento.'
                : status === 'paid_confirmed'
                  ? 'Pago cobrado y asistencia registrada.'
                  : '¡Asistencia registrada exitosamente!'}
            </p>

            {/* Tarjeta del asistente */}
            <div className="ci-success-ticket">
              <div className="ci-success-ticket-top">
                <div className="ci-success-avatar">{initials}</div>
                <div className="ci-success-info">
                  <span className="ci-success-name">{reg.full_name}</span>
                  <span className="ci-success-event-name">{reg.event_name || reg.activity_name || '—'}</span>
                </div>
              </div>
              <div className="ci-success-ticket-num">
                TICKET · #{String(reg.id).padStart(4, '0')}
              </div>
            </div>

            <button className="ci-success-btn" onClick={() => setStatus('')}>Continuar</button>
          </div>
        </div>
      )}

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
          <button className="ci-btn-action ci-btn-action--confirm" onClick={handleMarkPaid} disabled={updating || uploading}>
            {updating ? <span className="ci-login-btn-spinner" /> : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Confirmar pago
              </>
            )}
          </button>
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


