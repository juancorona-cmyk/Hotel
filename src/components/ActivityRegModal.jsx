import { useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { fmtFecha } from '../lib/utils'
import { HOTEL_CLABE, HOTEL_TITULAR } from '../lib/registrationConstants'
import { useRegistration, WHATSAPP_OPTIONS, HOW_FOUND_OPTIONS } from '../hooks/useRegistration'
import './ActivityRegModal.css'

export default function ActivityRegModal({ activity, event, onClose }) {
  const reg = useRegistration({ event, activity })

  // Bloquear scroll del body mientras el modal esté abierto
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const handleShareWhatsApp = () => {
    const dateStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const checkinUrl = `https://hotelpuntagaleria.mx/checkin?rid=${reg.registrationId}`
    const msg = `🎫 *TICKET DE ACCESO — Hotel Punta Galería*\n\n`
      + `👤 *${reg.fullName.trim()}*\n`
      + `📋 *${activity.name}*${event ? ' — ' + event.name : ''}\n`
      + `🎟️ Ticket: #${reg.ticketId}\n`
      + `📅 ${dateStr}\n`
      + `💵 ${event?.price > 0 ? '$' + parseFloat(event.price).toFixed(2) + ' MXN' : 'GRATIS'} | Pago: ${reg.paymentMethod === 'transferencia' ? 'Transferencia' : 'Presencial'}\n\n`
      + `📍 Hotel Punta Galería, Morelia, Mich.\n\n`
      + `🔗 Link de check-in: ${checkinUrl}`

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
  }

  return (
    <div className="arm-overlay">
      <div className="arm-card">

        {/* Header */}
        <div className="arm-header">
          <div className="arm-header__info">
            <span className="arm-eyebrow">Inscripción</span>
            <h2 className="arm-title">{activity.name}</h2>
            {event && (
              <div className="arm-header__pills">
                {event.date && (
                  <span className="arm-header__pill">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {fmtFecha(event.date, true)}
                  </span>
                )}
                {event.price > 0 && (
                  <span className="arm-header__pill arm-header__pill--price">
                    ${parseFloat(event.price).toFixed(2)}
                  </span>
                )}
                {reg.capacity > 0 && (
                  <span className="arm-header__pill arm-header__pill--spots" style={{ borderColor: reg.spotsColor, color: reg.spotsColor }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    {reg.spotsLeft === null
                      ? `${reg.capacity} lugares`
                      : reg.spotsLeft <= 3 && reg.spotsLeft > 0
                        ? `¡Solo ${reg.spotsLeft} lugar${reg.spotsLeft === 1 ? '' : 'es'}!`
                        : reg.spotsLeft === 0
                          ? 'Sin lugares'
                          : `${reg.spotsLeft} de ${reg.capacity} disponibles`
                    }
                  </span>
                )}
              </div>
            )}
          </div>
          <button className="arm-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Éxito siempre tiene prioridad — incluso si era el último lugar */}
        {reg.success && reg.paymentPending ? (
          /* ── Transferencia pendiente ── */
          <div className="arm-pend">

            <div className="arm-pend__status">
              <div className="arm-pend__orbit">
                <svg className="arm-pend__ring" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" stroke="#f59e0b" strokeWidth="3" strokeDasharray="226" strokeDashoffset="56" strokeLinecap="round"/>
                </svg>
                <div className="arm-pend__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.2" strokeLinecap="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                </div>
              </div>
              <div className="arm-pend__badge">Verificando pago</div>
            </div>

            <h2 className="arm-pend__title">Registro recibido</h2>
            <p className="arm-pend__sub">Tu lugar está reservado. Cuando recepción confirme tu transferencia, tu ticket aparecerá aquí automáticamente.</p>

            {reg.registrationId && (
              <div className="arm-pend__chip">
                <span className="arm-pend__chip-label">Ticket</span>
                <span className="arm-pend__chip-num">#{reg.ticketId}</span>
                <span className="arm-pend__chip-sep"/>
                <span className="arm-pend__chip-name">{reg.fullName}</span>
              </div>
            )}

            <div className="arm-bank-card arm-bank-card--sm">
              <div className="arm-bank-field">
                <span className="arm-bank-field__label">CLABE Interbancaria</span>
                <div className="arm-bank-field__row">
                  <span className="arm-bank-field__clabe">{HOTEL_CLABE.replace(/(.{4})/g, '$1 ').trim()}</span>
                  <button
                    type="button"
                    className={`arm-bank-copy${reg.copiedClabe ? ' arm-bank-copy--ok' : ''}`}
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(HOTEL_CLABE) } catch {}
                      reg.setCopiedClabe(true)
                      setTimeout(() => reg.setCopiedClabe(false), 2200)
                    }}
                  >
                    {reg.copiedClabe
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    }
                    {reg.copiedClabe ? 'Copiada' : 'Copiar'}
                  </button>
                </div>
              </div>
              <div className="arm-bank-divider"/>
              <div className="arm-bank-row2">
                <div className="arm-bank-field arm-bank-field--half">
                  <span className="arm-bank-field__label">Titular</span>
                  <span className="arm-bank-field__val">{HOTEL_TITULAR}</span>
                </div>
                {event?.price > 0 && (
                  <div className="arm-bank-field arm-bank-field--half arm-bank-field--right">
                    <span className="arm-bank-field__label">Monto</span>
                    <span className="arm-bank-field__val arm-bank-field__amount">${parseFloat(event.price).toFixed(2)} <small>MXN</small></span>
                  </div>
                )}
              </div>
            </div>

            {/* Proof upload / sent status */}
            {reg.proofUploaded ? (
              <div className="arm-pend__proof-ok">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <div>
                  <strong>Comprobante recibido</strong>
                  <span>Lo verificaremos y confirmaremos tu acceso pronto</span>
                </div>
              </div>
            ) : (
              <div className="arm-pend__upload">
                <p className="arm-pend__upload-hint">Adjunta tu comprobante para agilizar la verificación</p>
                <label className={`arm-pend__upload-btn${reg.uploadingProof ? ' arm-pend__upload-btn--loading' : ''}`}>
                  {reg.uploadingProof ? (
                    <>
                      <svg className="arm-pend__upload-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Adjuntar comprobante
                    </>
                  )}
                  <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={reg.handleProofUpload} disabled={reg.uploadingProof} />
                </label>
                {reg.proofError && <p className="arm-pend__upload-error">{reg.proofError}</p>}
              </div>
            )}

            {/* Waiting dots */}
            <div className="arm-pend__waiting">
              <span className="arm-pend__dot"/><span className="arm-pend__dot"/><span className="arm-pend__dot"/>
              <span>Esperando confirmación de recepción</span>
            </div>

            <button className="arm-success__close-btn" onClick={onClose}>Cerrar</button>
          </div>

        ) : reg.success ? (
          /* ── Pago confirmado: mostrar ticket completo ── */
          <div className="arm-success">
            {/* Check animado */}
            <div className="arm-success__check">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="#eef4e0"/>
                <circle cx="32" cy="32" r="26" fill="#d6e9a0"/>
                <polyline points="20,33 28,41 44,23" stroke="#3d5012" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h2 className="arm-success__title">¡Registro exitoso!</h2>

            {/* Ticket card — dos columnas: # izquierda, evento+fecha derecha */}
            <div className="arm-success__ticket">
              <div className="arm-success__ticket-cols">
                <div className="arm-success__ticket-left">
                  <span className="arm-success__ticket-label">TICKET</span>
                  <span className="arm-success__ticket-id">#{reg.ticketId}</span>
                </div>
                <div className="arm-success__ticket-divider" aria-hidden="true"/>
                <div className="arm-success__ticket-right">
                  <span className="arm-success__ticket-event-name">
                    {event?.name || activity?.name || 'Evento'}
                  </span>
                  {event?.date && (
                    <span className="arm-success__ticket-date">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {fmtFecha(event.date, true)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Aviso de acceso */}
            <p className="arm-success__access-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Para acceder al evento presenta este ticket en la entrada.
            </p>

            {/* Botones apilados */}
            <div className="arm-success__actions">
              <button
                className={`arm-success__btn arm-success__btn--pdf ${reg.downloadingPDF ? 'loading' : ''}`}
                onClick={reg.handleDownloadPDF}
                disabled={reg.downloadingPDF}
              >
                <span className="arm-success__btn-icon">
                  {reg.downloadingPDF
                    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13"/><polyline points="8 12 12 16 16 12"/><path d="M4 19h16"/></svg>
                  }
                </span>
                <span className="arm-success__btn-label">
                  <span className="arm-success__btn-title">{reg.downloadingPDF ? 'Generando PDF…' : 'Descargar PDF'}</span>
                  <span className="arm-success__btn-sub">Guarda tu ticket en el celular</span>
                </span>
              </button>

              <button className="arm-success__btn arm-success__btn--wa" onClick={handleShareWhatsApp}>
                <span className="arm-success__btn-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </span>
                <span className="arm-success__btn-label">
                  <span className="arm-success__btn-title">Recibir por WhatsApp</span>
                  <span className="arm-success__btn-sub">Te enviamos el ticket ahora</span>
                </span>
              </button>
            </div>

            {/* QR oculto — solo para serializar en el PDF. opacity:0 + position:absolute garantiza que el navegador renderiza el SVG y XMLSerializer lo captura */}
            {reg.registrationId && (
              <QRCodeSVG
                ref={reg.qrSvgRef}
                value={`https://hotelpuntagaleria.mx/checkin?rid=${reg.registrationId}`}
                size={180}
                level="H"
                includeMargin={true}
                style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
              />
            )}

            <button className="arm-success__close-btn" onClick={onClose}>Cerrar</button>
          </div>
        ) : reg.isSoldOut ? (
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
        ) : reg.step === 1 ? (
          <form onSubmit={reg.handleStep1} className="arm-form">
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
                value={reg.fullName}
                onChange={e => { reg.setFullName(e.target.value); reg.setError('') }}
                placeholder="Tu nombre completo"
              />
            </div>

            <div className="arm-field">
              <label className="arm-label">Número de teléfono *</label>
              <input
                type="tel"
                className={`arm-input${reg.phoneOk ? ' arm-input--ok' : reg.phoneBad ? ' arm-input--error' : ''}`}
                value={reg.phone}
                onChange={e => { reg.setPhone(e.target.value); reg.setError('') }}
                placeholder="Ej: 667 123 4567"
              />
              {reg.phoneBad && <p className="arm-phone-hint">Ej: 667 123 4567 · +1 555 000 1234 · +52 667 123 4567</p>}
            </div>

            <div className="arm-field">
              <label className="arm-label">¿Cómo te enteraste del evento? *</label>
              <div className="arm-radio-group">
                {HOW_FOUND_OPTIONS.map(opt => (
                  <label key={opt} className={`arm-radio-label ${reg.howFound === opt ? 'arm-radio-label--active' : ''}`}>
                    <input type="radio" name="howFound" value={opt} checked={reg.howFound === opt}
                      onChange={() => { reg.setHowFound(opt); reg.setError('') }} />
                    {opt}
                  </label>
                ))}
              </div>
              {reg.howFound === 'Otros' && (
                <input type="text" className="arm-input arm-input--sm"
                  value={reg.howFoundOther} onChange={e => reg.setHowFoundOther(e.target.value)}
                  placeholder="¿Cuál?" />
              )}
            </div>

            <div className="arm-field">
              <label className="arm-label">¿Te gustaría unirte al grupo de WhatsApp? *</label>
              <div className="arm-radio-group">
                {WHATSAPP_OPTIONS.map(opt => (
                  <label key={opt} className={`arm-radio-label ${reg.whatsapp === opt ? 'arm-radio-label--active' : ''}`}>
                    <input type="radio" name="whatsapp" value={opt} checked={reg.whatsapp === opt}
                      onChange={() => { reg.setWhatsapp(opt); reg.setError('') }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {reg.error && <p className="arm-error">{reg.error}</p>}

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

            {reg.showTransferInfo ? (
              <div className="arm-bank-card">
                <div className="arm-bank-card__head">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  Datos de transferencia
                </div>

                <div className="arm-bank-field">
                  <span className="arm-bank-field__label">CLABE Interbancaria</span>
                  <div className="arm-bank-field__row">
                    <span className="arm-bank-field__clabe">
                      {HOTEL_CLABE.replace(/(.{4})/g, '$1 ').trim()}
                    </span>
                    <button
                      type="button"
                      className={`arm-bank-copy${reg.copiedClabe ? ' arm-bank-copy--ok' : ''}`}
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(HOTEL_CLABE) } catch {}
                        reg.setCopiedClabe(true)
                        setTimeout(() => reg.setCopiedClabe(false), 2200)
                      }}
                    >
                      {reg.copiedClabe
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      }
                      {reg.copiedClabe ? 'Copiada' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div className="arm-bank-divider"/>

                <div className="arm-bank-row2">
                  <div className="arm-bank-field arm-bank-field--half">
                    <span className="arm-bank-field__label">Titular</span>
                    <span className="arm-bank-field__val">{HOTEL_TITULAR}</span>
                  </div>
                  {event?.price > 0 && (
                    <div className="arm-bank-field arm-bank-field--half arm-bank-field--right">
                      <span className="arm-bank-field__label">Monto</span>
                      <span className="arm-bank-field__val arm-bank-field__amount">${parseFloat(event.price).toFixed(2)} <small>MXN</small></span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="arm-submit"
                  style={{ marginTop: 16 }}
                  onClick={() => reg.handlePayment('transferencia')}
                  disabled={reg.submitting}
                >
                  {reg.submitting ? 'Registrando…' : 'Confirmar registro'}
                </button>
                <button type="button" className="arm-back-link" onClick={() => reg.setShowTransferInfo(false)}>
                  ← Regresar
                </button>
              </div>
            ) : (
              <div className="arm-pay-options">
                <button
                  type="button"
                  className="arm-pay-card"
                  onClick={() => reg.setShowTransferInfo(true)}
                  disabled={reg.submitting}
                >
                  <div className="arm-pay-card__icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2"/>
                      <line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                  </div>
                  <div className="arm-pay-card__info">
                    <strong>Transferencia bancaria</strong>
                    <span>Ver CLABE y confirmar pago</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                <button
                  type="button"
                  className="arm-pay-card"
                  onClick={() => reg.handlePayment('presencial')}
                  disabled={reg.submitting}
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
            )}

            {reg.error && <p className="arm-error" style={{ marginTop: 4 }}>{reg.error}</p>}
            {reg.submitting && <p style={{ textAlign:'center', color:'#888', fontSize:13, marginTop:8 }}>Registrando…</p>}

            {!reg.showTransferInfo && (
              <button type="button" className="arm-back-link" onClick={() => reg.setStep(1)}>
                ← Regresar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
