import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getEventBySlug, createActivityRegistration, getRegistrationCountByEvent, trackEvent } from '../lib/turso'
import { fmtFecha, isValidPhone } from '../lib/utils'
import './EventoPage.css'

export default function EventoPage() {
  const { slug } = useParams()
  const navigate  = useNavigate()

  const [event, setEvent]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [spotsLeft, setSpotsLeft] = useState(null)

  const [step, setStep]         = useState(1)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone]       = useState('')
  const [notes, setNotes]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [registrationId, setRegistrationId] = useState(null)
  const [copied, setCopied]     = useState(false)
  const [ticketCopied, setTicketCopied] = useState(false)

  const pageUrl = window.location.href

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = pageUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  const shareWhatsApp = () => {
    const msg = `¡Te invito al evento *${event?.name}* en Hotel Punta Galería!\n\nRegístrate aquí: ${pageUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
  }

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
      setLoading(false)
    }
    load()
  }, [slug])

  const capacity  = Number(event?.capacity ?? 0)
  const isSoldOut = capacity > 0 && spotsLeft === 0

  const handleStep1 = (e) => {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Por favor ingresa tu nombre completo'); return }
    if (!phone.trim())    { setError('Por favor ingresa tu número de teléfono'); return }
    if (!isValidPhone(phone)) { setError('Ingresa un número válido (ej: 667 123 4567 o +1 555 000 1234)'); return }
    setStep(2)
  }

  const handlePayment = async (method) => {
    setError('')
    setSubmitting(true)
    try {
      const regId = await createActivityRegistration(
        event.activity_id ?? 0,
        event.name,
        fullName.trim(),
        phone.trim(),
        '',
        '',
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
      setRegistrationId(regId)
      setSuccess(true)
    } catch {
      setError('Ocurrió un error al registrarte. Intenta nuevamente.')
      setStep(1)
    } finally {
      setSubmitting(false)
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

      <div className="ep-page">
        <div className="ep-container">

          <button className="ep-back" onClick={() => navigate('/')}>← Volver al inicio</button>

          <div className="ep-grid">

            {/* ── Left: event info ── */}
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

              <div className="ep-share">
                <button
                  className={`ep-share__copy${copied ? ' ep-share__copy--ok' : ''}`}
                  onClick={copyLink}
                >
                  {copied ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      Copiar enlace
                    </>
                  )}
                </button>

                <button className="ep-share__wa" onClick={shareWhatsApp}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Enviar por WhatsApp
                </button>
              </div>
            </div>

            {/* ── Right: form / soldout / success ── */}
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
              ) : success ? (
                <div className="ep-success">
                  <div className="ep-success-check">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <h2>¡Registro exitoso!</h2>
                  <p>Este es tu código QR de entrada. Guárdalo o compártelo para presentarlo al staff en la puerta.</p>

                  {registrationId && (
                    <div className="ep-ticket-qr">
                      <QRCodeSVG
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
                        className="ep-share__wa"
                        onClick={() => {
                          const ticketUrl = `https://hotelpuntagaleria.mx/checkin?rid=${registrationId}`
                          const msg = `Mi ticket para *${event?.name}* en Hotel Punta Galería:\n\n${ticketUrl}\n\n¡Presenta este enlace en la entrada!`
                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Compartir mi ticket
                      </button>
                    )}
                    {registrationId && (
                      <button
                        className={`ep-share__copy${ticketCopied ? ' ep-share__copy--ok' : ''}`}
                        onClick={async () => {
                          const ticketUrl = `https://hotelpuntagaleria.mx/checkin?rid=${registrationId}`
                          try { await navigator.clipboard.writeText(ticketUrl) } catch { /* fallback */ }
                          setTicketCopied(true)
                          setTimeout(() => setTicketCopied(false), 2200)
                        }}
                      >
                        {ticketCopied ? (
                          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>¡Copiado!</>
                        ) : (
                          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Copiar enlace del ticket</>
                        )}
                      </button>
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
                      <label className="ep-label">Comentario adicional <span>(opcional)</span></label>
                      <textarea
                        className="ep-input ep-textarea"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Algún comentario o pregunta…"
                        rows="3"
                      />
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

                  <div className="ep-pay-options">
                    <button
                      type="button"
                      className="ep-pay-card"
                      onClick={() => handlePayment('transferencia')}
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
                        <span>Te enviamos los datos por WhatsApp</span>
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

                  {error && <p className="ep-error" style={{ marginTop: 12 }}>{error}</p>}
                  {submitting && <p style={{ textAlign:'center', color:'#888', fontSize:13, marginTop:12 }}>Registrando…</p>}

                  <button type="button" className="ep-back-btn" onClick={() => setStep(1)} style={{ marginTop: 16 }}>
                    ← Regresar
                  </button>
                </div>
              )}
            </div>

          </div>{/* ep-grid */}
        </div>
      </div>
    </>
  )
}
