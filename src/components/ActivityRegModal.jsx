import { useState, useEffect } from 'react'
import { createActivityRegistration, getRegistrationCountByEvent } from '../lib/turso'
import './ActivityRegModal.css'

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
function fmtDate(s) {
  if (!s) return ''
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${parseInt(m[3])} de ${MESES[parseInt(m[2]) - 1]} ${m[1]}`
  return s
}

// Validates Mexican numbers (10 digits, starts 2-9) or international (+XX...)
function isValidPhone(raw) {
  const digits = raw.replace(/[\s\-().+]/g, '')
  if (raw.trim().startsWith('+')) return /^\+\d{7,15}$/.test(raw.trim().replace(/[\s\-().]/g, ''))
  if (/^[2-9]\d{9}$/.test(digits)) return true
  if (/^\d{7}$/.test(digits)) return true
  return false
}

export default function ActivityRegModal({ activity, event, onClose }) {
  const [step, setStep]                   = useState(1)
  const [fullName, setFullName]           = useState('')
  const [phone, setPhone]                 = useState('')
  const [howFound, setHowFound]           = useState('')
  const [howFoundOther, setHowFoundOther] = useState('')
  const [whatsapp, setWhatsapp]           = useState('')
  const [error, setError]                 = useState('')
  const [saving, setSaving]               = useState(false)
  const [success, setSuccess]             = useState(false)

  // Capacity tracking
  const [spotsLeft, setSpotsLeft]   = useState(null)
  const [spotsLoading, setSpotsLoading] = useState(false)

  const capacity = event?.capacity > 0 ? Number(event.capacity) : 0

  useEffect(() => {
    if (!event?.id || !capacity) return
    setSpotsLoading(true)
    getRegistrationCountByEvent(event.id)
      .then(count => setSpotsLeft(Math.max(0, capacity - count)))
      .catch(() => setSpotsLeft(null))
      .finally(() => setSpotsLoading(false))
  }, [event?.id, capacity])

  const isSoldOut = capacity > 0 && spotsLeft === 0 && !spotsLoading

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
    setSaving(true)
    const howFoundFinal = howFound === 'Otros' ? `Otros: ${howFoundOther.trim() || '?'}` : howFound
    try {
      await createActivityRegistration(
        activity.id,
        activity.name,
        fullName.trim(),
        phone.trim(),
        howFoundFinal,
        whatsapp,
        event?.id ?? null,
        event?.name ?? '',
        method,
      )
      if (spotsLeft !== null) setSpotsLeft(s => Math.max(0, s - 1))
      setSuccess(true)
      setTimeout(onClose, 2600)
    } catch {
      setError('Error al registrar. Intenta nuevamente.')
      setStep(1)
    } finally {
      setSaving(false)
    }
  }

  // Spots badge config
  const spotsColor = spotsLeft !== null && capacity > 0
    ? spotsLeft <= 3 ? '#dc2626'
    : spotsLeft <= 8 ? '#d97706'
    : '#5a6c1e'
    : '#5a6c1e'

  const phoneTyped = phone.trim().length > 0
  const phoneOk    = phoneTyped && isValidPhone(phone)
  const phoneBad   = phoneTyped && !phoneOk

  return (
    <div className="arm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="arm-card">

        {/* Header */}
        <div className="arm-header">
          <div>
            <span className="arm-eyebrow">Inscripción</span>
            <h2 className="arm-title">{activity.name}</h2>
          </div>
          <button className="arm-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Event details banner */}
        {event && (
          <div className="arm-event-banner">
            <div className="arm-event-banner__name">{event.name}</div>
            <div className="arm-event-banner__meta">
              {event.date && (
                <span className="arm-event-banner__pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {fmtDate(event.date)}
                </span>
              )}
              {event.price > 0 && (
                <span className="arm-event-banner__pill arm-event-banner__pill--price">
                  ${parseFloat(event.price).toFixed(2)}
                </span>
              )}
              {capacity > 0 && (
                <span
                  className="arm-event-banner__pill arm-spots-pill"
                  style={{ borderColor: spotsColor, color: spotsColor }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  {spotsLoading
                    ? `${capacity} lugares`
                    : spotsLeft !== null
                      ? spotsLeft <= 3 && spotsLeft > 0
                        ? `¡Solo ${spotsLeft} lugar${spotsLeft === 1 ? '' : 'es'}!`
                        : spotsLeft === 0
                          ? 'Sin lugares'
                          : `${spotsLeft} de ${capacity} disponibles`
                      : `${capacity} lugares`
                  }
                </span>
              )}
            </div>
            {event.description && (
              <p className="arm-event-banner__desc">{event.description}</p>
            )}
          </div>
        )}

        {/* Sold out screen */}
        {isSoldOut ? (
          <div className="arm-soldout">
            <div className="arm-soldout__icon">🌴</div>
            <p className="arm-soldout__title">¡Lugares agotados!</p>
            <p className="arm-soldout__msg">
              Este evento se llenó. Síguenos para enterarte de los próximos eventos y clases.
            </p>
            <button className="arm-soldout__wa" onClick={() => window.open('https://wa.me/526677154727', '_blank')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Avisarme del próximo evento
            </button>
          </div>
        ) : success ? (
          <div className="arm-success">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p>¡Registro exitoso!</p>
            <small>Nos vemos pronto 🌿</small>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleStep1} className="arm-form">
            <div className="arm-steps">
              <span className="arm-step arm-step--active">1</span>
              <span className="arm-step-line"/>
              <span className="arm-step">2</span>
            </div>

            <div className="arm-field">
              <label className="arm-label">Nombre completo <span>(Persona que tomará la clase)</span> *</label>
              <input
                type="text"
                className="arm-input"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setError('') }}
                placeholder="Tu nombre completo"
              />
            </div>

            <div className="arm-field">
              <label className="arm-label">Número de teléfono *</label>
              <input
                type="tel"
                className={`arm-input${phoneOk ? ' arm-input--ok' : phoneBad ? ' arm-input--error' : ''}`}
                value={phone}
                onChange={e => { setPhone(e.target.value); setError('') }}
                placeholder="Ej: 667 123 4567"
              />
              {phoneBad && <p className="arm-phone-hint">Ej: 667 123 4567 · +1 555 000 1234 · +52 667 123 4567</p>}
            </div>

            <div className="arm-field">
              <label className="arm-label">¿Cómo te enteraste del evento? *</label>
              <div className="arm-radio-group">
                {['Instagram', 'Facebook', 'Conocido', 'Otros'].map(opt => (
                  <label key={opt} className={`arm-radio-label ${howFound === opt ? 'arm-radio-label--active' : ''}`}>
                    <input type="radio" name="howFound" value={opt} checked={howFound === opt}
                      onChange={() => { setHowFound(opt); setError('') }} />
                    {opt}
                  </label>
                ))}
              </div>
              {howFound === 'Otros' && (
                <input type="text" className="arm-input arm-input--sm"
                  value={howFoundOther} onChange={e => setHowFoundOther(e.target.value)}
                  placeholder="¿Cuál?" />
              )}
            </div>

            <div className="arm-field">
              <label className="arm-label">¿Te gustaría que te agreguemos al grupo de WhatsApp para futuros eventos y clases de Hotel Punta Galería? *</label>
              <div className="arm-radio-group">
                {['Sí', 'No', 'Ya estoy dentro'].map(opt => (
                  <label key={opt} className={`arm-radio-label ${whatsapp === opt ? 'arm-radio-label--active' : ''}`}>
                    <input type="radio" name="whatsapp" value={opt} checked={whatsapp === opt}
                      onChange={() => { setWhatsapp(opt); setError('') }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="arm-error">{error}</p>}

            <button type="submit" className="arm-submit">
              Continuar al pago →
            </button>
          </form>
        ) : (
          <div className="arm-form">
            <div className="arm-steps">
              <span className="arm-step arm-step--done">✓</span>
              <span className="arm-step-line arm-step-line--done"/>
              <span className="arm-step arm-step--active">2</span>
            </div>

            <p className="arm-pay-sub">¿Cómo realizarás tu pago{event?.price > 0 ? ` de $${parseFloat(event.price).toFixed(2)}` : ''}?</p>

            <div className="arm-pay-options">
              <button
                type="button"
                className="arm-pay-card"
                onClick={() => handlePayment('transferencia')}
                disabled={saving}
              >
                <div className="arm-pay-card__icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                </div>
                <div className="arm-pay-card__info">
                  <strong>Transferencia bancaria</strong>
                  <span>Te enviamos los datos por WhatsApp</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              <button
                type="button"
                className="arm-pay-card"
                onClick={() => handlePayment('presencial')}
                disabled={saving}
              >
                <div className="arm-pay-card__icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div className="arm-pay-card__info">
                  <strong>Pago presencial</strong>
                  <span>Paga en recepción el día del evento</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {error && <p className="arm-error" style={{ marginTop: 4 }}>{error}</p>}
            {saving && <p style={{ textAlign:'center', color:'#888', fontSize:13, marginTop:8 }}>Registrando…</p>}

            <button type="button" className="arm-back-link" onClick={() => setStep(1)}>
              ← Regresar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
