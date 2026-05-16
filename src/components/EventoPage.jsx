import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getEventBySlug, createActivityRegistration, getRegistrationCountByEvent, trackEvent, getRegistrationById, saveTransferProof, API_BASE } from '../lib/turso'
import { fmtFecha, isValidPhone } from '../lib/utils'
import './EventoPage.css'

export default function EventoPage() {
  const { slug } = useParams()
  const navigate  = useNavigate()
  const [searchParams] = useSearchParams()

  const [event, setEvent]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [spotsLeft, setSpotsLeft] = useState(null)

  const [step, setStep]         = useState(1)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone]       = useState('')
  const [notes, setNotes]       = useState('')
  const [howFound, setHowFound] = useState('')
  const [howFoundOther, setHowFoundOther] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [registrationId, setRegistrationId] = useState(null)
  const [ticketCopied, setTicketCopied] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [showTransferInfo, setShowTransferInfo] = useState(false)
  const [paymentPending, setPaymentPending] = useState(false)
  const [copiedClabe, setCopiedClabe] = useState(false)
  const [proofUploaded, setProofUploaded] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [proofError, setProofError] = useState('')
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  const qrSvgRef = useRef(null)

  const HOTEL_WA = '5214431234567'
  const HOTEL_CLABE = '5512382370397442'
  const HOTEL_TITULAR = 'Hotel Punta Galería'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const ev = await getEventBySlug(slug)
      setEvent(ev)
      if (ev?.id) {
        trackEvent('activity_reg_intent', { event_id: ev.id, event_name: ev.name, source: 'link' })
      }
      if (ev?.id && ev?.capacity > 0) {
        const count = await getRegistrationCountByEvent(ev.id)
        setSpotsLeft(Math.max(0, Number(ev.capacity) - count))
      }

      const ridParam = searchParams.get('rid')
      if (ridParam) {
        try {
          const reg = await getRegistrationById(ridParam)
          if (reg) {
            setRegistrationId(reg.id)
            setFullName(reg.full_name || '')
            setPaymentMethod(reg.payment_method || '')
            const isPaid = reg.paid === 1 || reg.paid === '1'
            setSuccess(true)
            if (!isPaid && reg.payment_method === 'transferencia') {
              setPaymentPending(true)
              if (reg.transfer_proof_url) setProofUploaded(true)
            }
          }
        } catch {}
      }

      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!paymentPending || !registrationId) return
    const interval = setInterval(async () => {
      try {
        const reg = await getRegistrationById(registrationId)
        if (reg?.paid === 1 || reg?.paid === '1') setPaymentPending(false)
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [paymentPending, registrationId])

  const capacity  = Number(event?.capacity ?? 0)
  const isSoldOut = capacity > 0 && spotsLeft === 0

  // Lock body scroll on mobile for single-view states
  useEffect(() => {
    if (window.innerWidth > 760) return
    const isSingleView = !loading && (success || isSoldOut)
    if (isSingleView) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [loading, success, isSoldOut])

  const handleStep1 = (e) => {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Por favor ingresa tu nombre completo'); return }
    if (!phone.trim())    { setError('Por favor ingresa tu número de teléfono'); return }
    if (!isValidPhone(phone)) { setError('Ingresa un número válido (ej: 667 123 4567 o +1 555 000 1234)'); return }
    if (!howFound)        { setError('Por favor indica cómo te enteraste'); return }
    if (!whatsapp)        { setError('Por favor responde la pregunta de WhatsApp'); return }
    setStep(2)
  }

  const handlePayment = async (method) => {
    setError('')
    setSubmitting(true)
    setShowTransferInfo(false)
    try {
      const howFoundFinal = howFound === 'Otros' ? `Otros: ${howFoundOther.trim() || '?'}` : howFound
      const regId = await createActivityRegistration(
        event.activity_id ?? 0,
        event.name,
        fullName.trim(),
        phone.trim(),
        howFoundFinal,
        whatsapp,
        event.id,
        event.name,
        method
      )
      trackEvent('activity_reg_confirm', {
        activity_id: event.activity_id,
        activity_name: event.name,
        event_id: event.id,
        payment_method: method,
        source: 'link'
      })
      if (spotsLeft !== null) setSpotsLeft(s => Math.max(0, s - 1))
      setPaymentMethod(method)
      setRegistrationId(regId)
      if (method === 'transferencia') setPaymentPending(true)
      setSuccess(true)
      navigate(`/evento/${slug}?rid=${regId}`, { replace: true })
    } catch {
      setError('Ocurrió un error al registrarte. Intenta nuevamente.')
      setStep(1)
    } finally {
      setSubmitting(false)
    }
  }

  const compressImage = (file) => new Promise((resolve) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = (e) => {
      img.onload = () => {
        const MAX = 1400
        let w = img.width, h = img.height
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingProof(true)
    setProofError('')
    try {
      const base64 = await compressImage(file)
      const res = await fetch(`${API_BASE}/.netlify/functions/upload-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, registrationId, eventName: event?.name })
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Error al subir')
      await saveTransferProof(registrationId, data.url)
      setProofUploaded(true)
    } catch (err) {
      setProofError('No se pudo subir el comprobante. Intenta de nuevo.')
    } finally {
      setUploadingProof(false)
    }
  }

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true)
    try {
      const svgEl = qrSvgRef.current
      const svgStr = svgEl ? new XMLSerializer().serializeToString(svgEl) : ''
      const svgB64 = svgStr ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}` : ''
      const ticketUrl = `https://hotelpuntagaleria.mx/checkin?rid=${registrationId}`
      const eventDate = event?.date ? new Date(event.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
      const PW = 390
      const PH = 844
      const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
@page{size:${PW}px ${PH}px;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${PW}px;height:${PH}px;overflow:hidden}
body{font-family:'Montserrat',sans-serif;background:#5a6c1e;display:flex;flex-direction:column}
.top{background:#5a6c1e;padding:24px 22px 18px;text-align:center;color:#fff;flex-shrink:0}
.hotel{font-size:9px;font-weight:800;letter-spacing:2.5px;opacity:0.6;margin-bottom:6px;text-transform:uppercase}
.event-name{font-size:22px;font-weight:900;line-height:1.1;margin-bottom:5px}
.event-desc{font-size:11px;font-weight:500;opacity:0.82;line-height:1.4}
.body{background:#fff;flex:1;display:flex;flex-direction:column;align-items:center;padding:16px 18px 0;overflow:hidden}
.qr-wrap{background:#f7f8f3;border-radius:14px;padding:12px;margin-bottom:10px;flex-shrink:0}
.qr-wrap img{width:200px;height:200px;display:block}
.ticket-info{text-align:center;margin-bottom:10px;flex-shrink:0}
.ticket-num{font-size:10px;font-weight:800;color:#8fa03a;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:3px}
.ticket-name{font-size:18px;font-weight:900;color:#111;line-height:1.1}
.hint{display:inline-flex;align-items:center;gap:5px;background:#eef4e8;border:1.5px solid #c9d98a;border-radius:99px;padding:4px 11px;font-size:9px;font-weight:700;color:#4a5a1e;margin-top:5px}
.divider{width:100%;border:none;border-top:1.5px solid #f0f0ec;margin:0 0 10px;flex-shrink:0}
.meta{width:100%;display:flex;flex-direction:column;gap:6px;flex-shrink:0}
.row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f7f8f3;border-radius:9px}
.lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#8fa03a}
.val{font-size:12px;font-weight:700;color:#1a1a1a}
.footer{background:#5a6c1e;width:100%;padding:12px 22px;text-align:center;font-size:9px;color:rgba(255,255,255,0.7);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;flex-shrink:0;margin-top:auto}
</style></head><body>
<div class="top">
  <div class="hotel">Hotel Punta Galería</div>
  <div class="event-name">${event?.name || ''}</div>
  ${event?.description ? `<div class="event-desc">${event.description}</div>` : ''}
</div>
<div class="body">
  ${svgB64 ? `<div class="qr-wrap"><img src="${svgB64}" alt="QR"/></div>` : ''}
  <div class="ticket-info">
    <div class="ticket-num">Ticket #${String(registrationId).padStart(4, '0')}</div>
    <div class="ticket-name">${fullName}</div>
    <div class="hint"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>Entrada confirmada</div>
  </div>
  <hr class="divider"/>
  <div class="meta">
    <div class="row"><span class="lbl">Nombre</span><span class="val">${fullName}</span></div>
    ${eventDate ? `<div class="row"><span class="lbl">Fecha</span><span class="val">${eventDate}</span></div>` : ''}
    ${event?.price > 0 ? `<div class="row"><span class="lbl">Precio</span><span class="val">$${parseFloat(event.price).toFixed(2)} MXN</span></div>` : ''}
  </div>
</div>
<div class="footer">Presenta este QR en la entrada · Hotel Punta Galería</div>
</body></html>`

      const res = await fetch(`${API_BASE}/.netlify/functions/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, filename: `ticket-${String(registrationId).padStart(4, '0')}.pdf`, pageWidth: PW, pageHeight: PH })
      })
      if (!res.ok) throw new Error('Error generando PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket-${String(registrationId).padStart(4, '0')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setDownloadingPDF(false)
    }
  }

  // ── Loading ──────────────────────────────────────────
  if (loading) {
    return (
      <>
        <header className="ep-header">
          <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ep-logo" />
        </header>
        <div className="ep-page">
          <div className="ep-container">
            <div className="ep-loading">
              <div className="ep-spinner"/>
              <p>Cargando evento…</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Not found ────────────────────────────────────────
  if (!event) {
    return (
      <>
        <header className="ep-header">
          <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ep-logo" />
        </header>
        <div className="ep-page">
          <div className="ep-container">
            <button className="ep-back" onClick={() => navigate('/')}>← Volver al inicio</button>
            <div className="ep-not-found">
              <div className="ep-not-found__icon">🌴</div>
              <h2>Evento no disponible</h2>
              <p>El evento que buscas no existe o ya no está activo.</p>
              <button className="ep-back-btn" onClick={() => navigate('/')}>Ir al inicio</button>
            </div>
          </div>
        </div>
      </>
    )
  }

  const spotsColor = spotsLeft !== null && capacity > 0
    ? spotsLeft <= 3 ? '#dc2626' : spotsLeft <= 8 ? '#d97706' : '#5a6c1e'
    : '#5a6c1e'

  const phoneTyped = phone.trim().length > 0
  const phoneOk    = phoneTyped && isValidPhone(phone)
  const phoneBad   = phoneTyped && !phoneOk

  return (
    <>
      <header className="ep-header">
        <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ep-logo" />
      </header>

      <div className={`ep-page${success || isSoldOut ? ' ep-page--done' : ''}`}>
        <div className="ep-container">

          <button className="ep-back" onClick={() => navigate('/')}>← Volver al inicio</button>

          <div className="ep-grid">

            {/* ── Col 1: form / soldout / success ── */}
            <div className="ep-col-form">
              {isSoldOut ? (
                <div className="ep-soldout">
                  <div className="ep-soldout__icon">🌴</div>
                  <h2>¡Lugares agotados!</h2>
                  <p>Este evento está lleno. Mantente al tanto de próximos eventos en nuestras redes.</p>
                  <a href="https://wa.me/526677154727" target="_blank" rel="noopener noreferrer" className="ep-soldout__wa">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Avisarme del próximo evento
                  </a>
                </div>
              ) : success && paymentPending ? (
                /* ── Transferencia pendiente ── */
                <div className="ep-pend">

                  {/* Status header */}
                  <div className="ep-pend__status">
                    <div className="ep-pend__orbit">
                      <svg className="ep-pend__ring" viewBox="0 0 80 80" fill="none">
                        <circle cx="40" cy="40" r="36" stroke="#f59e0b" strokeWidth="3" strokeDasharray="226" strokeDashoffset="56" strokeLinecap="round"/>
                      </svg>
                      <div className="ep-pend__icon">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.2" strokeLinecap="round">
                          <rect x="2" y="5" width="20" height="14" rx="2"/>
                          <line x1="2" y1="10" x2="22" y2="10"/>
                        </svg>
                      </div>
                    </div>
                    <div className="ep-pend__badge">Verificando pago</div>
                  </div>

                  <h2 className="ep-pend__title">Registro recibido</h2>
                  <p className="ep-pend__sub">
                    Tu lugar está reservado. Cuando recepción confirme tu transferencia, tu QR aparecerá aquí de forma automática.
                  </p>

                  {/* Ticket chip */}
                  {registrationId && (
                    <div className="ep-pend__chip">
                      <span className="ep-pend__chip-label">Ticket</span>
                      <span className="ep-pend__chip-num">#{String(registrationId).padStart(4, '0')}</span>
                      <span className="ep-pend__chip-sep"/>
                      <span className="ep-pend__chip-name">{fullName}</span>
                      {event?.name && <><span className="ep-pend__chip-sep"/><span className="ep-pend__chip-event">{event.name}</span></>}
                    </div>
                  )}

                  {/* Bank data card */}
                  <div className="ep-pend__card">
                    <div className="ep-pend__card-head">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                      </svg>
                      Datos de transferencia
                    </div>

                    <div className="ep-pend__field">
                      <span className="ep-pend__field-label">CLABE Interbancaria</span>
                      <div className="ep-pend__field-row">
                        <span className="ep-pend__field-clabe">
                          {HOTEL_CLABE.replace(/(.{4})/g, '$1 ').trim()}
                        </span>
                        <button
                          className={`ep-pend__copy${copiedClabe ? ' ep-pend__copy--ok' : ''}`}
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(HOTEL_CLABE) } catch {}
                            setCopiedClabe(true)
                            setTimeout(() => setCopiedClabe(false), 2200)
                          }}
                        >
                          {copiedClabe
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          }
                          {copiedClabe ? 'Copiada' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    <div className="ep-pend__divider"/>

                    <div className="ep-pend__row2">
                      <div className="ep-pend__field ep-pend__field--half">
                        <span className="ep-pend__field-label">Titular</span>
                        <span className="ep-pend__field-val">{HOTEL_TITULAR}</span>
                      </div>
                      {event?.price > 0 && (
                        <div className="ep-pend__field ep-pend__field--half ep-pend__field--right">
                          <span className="ep-pend__field-label">Monto</span>
                          <span className="ep-pend__field-val ep-pend__field-amount">${parseFloat(event.price).toFixed(2)} <small>MXN</small></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proof upload / sent status */}
                  {proofUploaded ? (
                    <div className="ep-pend__proof-ok">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <div>
                        <strong>Comprobante recibido</strong>
                        <span>Lo verificaremos y confirmaremos tu acceso pronto</span>
                      </div>
                    </div>
                  ) : (
                    <div className="ep-pend__upload">
                      <p className="ep-pend__upload-hint">Adjunta tu comprobante de transferencia para agilizar la verificación</p>
                      <label className={`ep-pend__upload-btn${uploadingProof ? ' ep-pend__upload-btn--loading' : ''}`}>
                        {uploadingProof ? (
                          <>
                            <svg className="ep-pend__upload-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                            Subiendo…
                          </>
                        ) : (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Adjuntar comprobante
                          </>
                        )}
                        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleProofUpload} disabled={uploadingProof} />
                      </label>
                      {proofError && <p className="ep-pend__upload-error">{proofError}</p>}
                    </div>
                  )}

                  {/* Waiting indicator */}
                  <div className="ep-pend__waiting">
                    <span className="ep-pend__waiting-dot"/><span className="ep-pend__waiting-dot"/><span className="ep-pend__waiting-dot"/>
                    <span>Esperando confirmación de recepción</span>
                  </div>

                  <a
                    href={`https://wa.me/526677154727?text=${encodeURIComponent(
                      `Hola, me registré para *${event?.name}*. Mi ticket es #${String(registrationId).padStart(4, '0')} a nombre de ${fullName}. Ya realicé mi transferencia — ¿me pueden avisar cuando confirmen mi pago?`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ep-pend__wa"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Avisarme cuando confirmen mi pago
                  </a>

                  <button className="ep-back-btn" onClick={() => navigate('/')}>
                    Volver al inicio
                  </button>
                </div>

              ) : success ? (
                /* ── Pago confirmado: mostrar QR ── */
                <div className="ep-success">
                  <div className="ep-success-check">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <h2>¡Registro exitoso!</h2>

                  {event && (
                    <div className="ep-success-event">
                      <span className="ep-success-event__name">{event.name}</span>
                      {event.description && (
                        <span className="ep-success-event__desc">{event.description}</span>
                      )}
                    </div>
                  )}
                  <div className="ep-success-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/></svg>
                    Este QR es tu entrada — el staff lo escaneará al llegar
                  </div>

                  {registrationId && (
                    <div className="ep-ticket-qr">
                      <QRCodeSVG
                        ref={qrSvgRef}
                        value={`https://hotelpuntagaleria.mx/checkin?rid=${registrationId}`}
                        size={180}
                        level="H"
                        includeMargin={true}
                        style={{ borderRadius: 12 }}
                      />
                      <div className="ep-ticket-meta">
                        <span className="ep-ticket-num">TICKET #{String(registrationId).padStart(4, '0')}</span>
                        <span className="ep-ticket-name">{fullName}</span>
                        {event?.name && <span className="ep-ticket-event">{event.name}</span>}
                      </div>
                    </div>
                  )}

                  <div className="ep-success-actions">
                    {registrationId && (
                      <button
                        className={`ep-share__pdf${downloadingPDF ? ' ep-share__pdf--loading' : ''}`}
                        onClick={handleDownloadPDF}
                        disabled={downloadingPDF}
                      >
                        {downloadingPDF ? (
                          <><svg className="ep-share__pdf-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>Generando PDF…</>
                        ) : (
                          <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>Descargar PDF</>
                        )}
                      </button>
                    )}
                    {registrationId && (
                      <a
                        className="ep-share__wa"
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Mi ticket para *${event?.name}* en Hotel Punta Galería:\nhttps://hotelpuntagaleria.mx/checkin?rid=${registrationId}\n\n¡Presenta este enlace en la entrada!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Recibir por WhatsApp
                      </a>
                    )}
                    <button className="ep-back-btn" onClick={() => navigate('/')}>Volver al inicio</button>
                  </div>
                </div>
              ) : step === 1 ? (
                <div className="ep-form-wrap">
                  <div className="ep-steps">
                    <span className="ep-step ep-step--active">1</span>
                    <span className="ep-step-line"/>
                    <span className="ep-step">2</span>
                  </div>
                  <h2 className="ep-form-title">Tus datos</h2>

                  <form onSubmit={handleStep1} className="ep-form">
                    <div className="ep-field">
                      <label className="ep-label">Nombre completo *</label>
                      <input
                        type="text"
                        className="ep-input"
                        value={fullName}
                        onChange={e => { setFullName(e.target.value); setError('') }}
                        placeholder="Tu nombre completo"
                      />                    </div>

                    <div className="ep-field">
                      <label className="ep-label">Número de teléfono *</label>
                      <input
                        type="tel"
                        className={`ep-input${phoneOk ? ' ep-input--ok' : phoneBad ? ' ep-input--error' : ''}`}
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setError('') }}
                        placeholder="Ej: 667 123 4567"
                      />
                      {phoneBad && <p className="ep-phone-hint">Ej: 667 123 4567 · +1 555 000 1234 · +52 667 123 4567</p>}
                    </div>

                    <div className="ep-field">
                      <label className="ep-label">¿Cómo te enteraste del evento? *</label>
                      <div className="ep-radio-group">
                        {['Instagram', 'Facebook', 'Conocido', 'Otros'].map(opt => (
                          <label key={opt} className={`ep-radio-label${howFound === opt ? ' ep-radio-label--active' : ''}`}>
                            <input type="radio" name="howFound" value={opt} checked={howFound === opt}
                              onChange={() => { setHowFound(opt); setError('') }} />
                            {opt}
                          </label>
                        ))}
                      </div>
                      {howFound === 'Otros' && (
                        <input type="text" className="ep-input ep-input--sm"
                          value={howFoundOther} onChange={e => setHowFoundOther(e.target.value)}
                          placeholder="¿Cuál?" style={{ marginTop: 8 }} />
                      )}
                    </div>

                    <div className="ep-field">
                      <label className="ep-label">¿Te gustaría unirte al grupo de WhatsApp? *</label>
                      <div className="ep-radio-group">
                        {['Sí', 'No'].map(opt => (
                          <label key={opt} className={`ep-radio-label${whatsapp === opt ? ' ep-radio-label--active' : ''}`}>
                            <input type="radio" name="whatsapp" value={opt} checked={whatsapp === opt}
                              onChange={() => { setWhatsapp(opt); setError('') }} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>

                    {error && <p className="ep-error">{error}</p>}

                    <button type="submit" className="ep-submit">
                      Continuar al pago →
                    </button>
                  </form>
                </div>
              ) : (
                <div className="ep-form-wrap">
                  <div className="ep-steps">
                    <span className="ep-step ep-step--done">✓</span>
                    <span className="ep-step-line ep-step-line--done"/>
                    <span className="ep-step ep-step--active">2</span>
                  </div>
                  <h2 className="ep-form-title">Método de pago</h2>
                  <p className="ep-pay-sub">¿Cómo realizarás tu pago{event.price > 0 ? ` de $${parseFloat(event.price).toFixed(2)}` : ''}?</p>

                  {showTransferInfo ? (
                    <div className="ep-pend__card" style={{ marginBottom: 0 }}>
                      <div className="ep-pend__card-head">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        Datos de transferencia
                      </div>

                      <div className="ep-pend__field">
                        <span className="ep-pend__field-label">CLABE Interbancaria</span>
                        <div className="ep-pend__field-row">
                          <span className="ep-pend__field-clabe">
                            {HOTEL_CLABE.replace(/(.{4})/g, '$1 ').trim()}
                          </span>
                          <button
                            type="button"
                            className={`ep-pend__copy${copiedClabe ? ' ep-pend__copy--ok' : ''}`}
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(HOTEL_CLABE) } catch {}
                              setCopiedClabe(true)
                              setTimeout(() => setCopiedClabe(false), 2200)
                            }}
                          >
                            {copiedClabe
                              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            }
                            {copiedClabe ? 'Copiada' : 'Copiar'}
                          </button>
                        </div>
                      </div>

                      <div className="ep-pend__divider"/>

                      <div className="ep-pend__row2">
                        <div className="ep-pend__field ep-pend__field--half">
                          <span className="ep-pend__field-label">Titular</span>
                          <span className="ep-pend__field-val">{HOTEL_TITULAR}</span>
                        </div>
                        {event.price > 0 && (
                          <div className="ep-pend__field ep-pend__field--half ep-pend__field--right">
                            <span className="ep-pend__field-label">Monto</span>
                            <span className="ep-pend__field-val ep-pend__field-amount">${parseFloat(event.price).toFixed(2)} <small>MXN</small></span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="ep-submit"
                        style={{ marginTop: 16 }}
                        onClick={() => handlePayment('transferencia')}
                        disabled={submitting}
                      >
                        {submitting ? 'Registrando…' : 'Confirmar registro'}
                      </button>
                      <button type="button" className="ep-back-btn" onClick={() => setShowTransferInfo(false)} style={{ marginTop: 8 }}>
                        ← Regresar
                      </button>
                    </div>
                  ) : (
                  <div className="ep-pay-options">
                    <button
                      type="button"
                      className="ep-pay-card"
                      onClick={() => setShowTransferInfo(true)}
                      disabled={submitting}
                    >
                      <div className="ep-pay-card__icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="20" height="14" rx="2"/>
                          <line x1="2" y1="10" x2="22" y2="10"/>
                        </svg>
                      </div>
                      <div className="ep-pay-card__info">
                        <strong>Transferencia bancaria</strong>
                        <span>Ver CLABE y confirmar pago</span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>

                    <button
                      type="button"
                      className="ep-pay-card"
                      onClick={() => handlePayment('presencial')}
                      disabled={submitting}
                    >
                      <div className="ep-pay-card__icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                      </div>
                      <div className="ep-pay-card__info">
                        <strong>Pago presencial</strong>
                        <span>Paga en recepción el día del evento</span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                  )}

                  {error && <p className="ep-error" style={{ marginTop: 12 }}>{error}</p>}
                  {submitting && <p style={{ textAlign:'center', color:'#888', fontSize:13, marginTop:12 }}>Registrando…</p>}

                  {!showTransferInfo && (
                    <button type="button" className="ep-back-btn" onClick={() => setStep(1)} style={{ marginTop: 16 }}>
                      ← Regresar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Col 2: event info ── */}
            <div className="ep-col-info">
              <div className="ep-hero">
                <p className="ep-eyebrow">Hotel Punta Galería · Evento</p>
                <h1 className="ep-title">{event.name}</h1>
              </div>

              <div className="ep-pills">
                {event.date && (
                  <div className="ep-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {fmtFecha(event.date, true)}
                  </div>
                )}
                {event.price > 0 && (
                  <div className="ep-pill ep-pill--price">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    ${parseFloat(event.price).toFixed(2)}
                  </div>
                )}
                {capacity > 0 && (
                  <div className="ep-pill ep-pill--spots" style={{ borderColor: spotsColor, color: spotsColor }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    {spotsLeft === null
                      ? `${capacity} lugares`
                      : isSoldOut
                        ? 'Sin lugares disponibles'
                        : spotsLeft <= 3
                          ? `¡Solo ${spotsLeft} lugar${spotsLeft === 1 ? '' : 'es'}!`
                          : `${spotsLeft} de ${capacity} disponibles`
                    }
                  </div>
                )}
              </div>

              {event.description && (
                <div className="ep-desc">
                  <p>{event.description}</p>
                </div>
              )}
            </div>

          </div>{/* ep-grid */}
        </div>
      </div>
    </>
  )
}
