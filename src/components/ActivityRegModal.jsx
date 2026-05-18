import { useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { fmtFecha } from '../lib/utils'
import { HOTEL_CLABE, HOTEL_TITULAR } from '../lib/registrationConstants'
import { useRegistration, WHATSAPP_OPTIONS, HOW_FOUND_OPTIONS } from '../hooks/useRegistration'
import './ActivityRegModal.css'

export default function ActivityRegModal({ activity, onClose, event }) {
  const reg = useRegistration({ activity, event, onRegistered: () => {} })

  // Bloquear scroll del body al abrir el modal
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  // Cerrar al presionar Escape
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const showPrice = (event?.price ?? 0) > 0

  return (
    <div className="arm-overlay" onClick={onClose}>
      <div className={`arm-card${reg.success || reg.isSoldOut ? ' arm-card--done' : ''}`} onClick={e => e.stopPropagation()}>
        
        {/* ── Header ── */}
        <header className="arm-header">
          <div className="arm-header__info">
            <span className="arm-eyebrow">{activity ? 'Clase' : 'Inscripción'}</span>
            <h2 className="arm-title">{activity?.name || event?.name}</h2>
            {event?.description && <p className="arm-header__desc">{event.description}</p>}
            <div className="arm-header__pills">
              {showPrice && (
                <span className="arm-header__pill arm-header__pill--price">
                  ${parseFloat(event.price).toFixed(2)}
                </span>
              )}
              {reg.capacity > 0 && (
                <span className="arm-header__pill arm-header__pill--spots" style={{ color: reg.spotsColor, borderColor: reg.spotsColor }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  </svg>
                  {reg.isSoldOut ? 'Agotado' : `${reg.spotsLeft} de ${reg.capacity} disponibles`}
                </span>
              )}
            </div>
          </div>
          <button className="arm-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        {/* ── Content ── */}
        {reg.restoring ? (
          <div className="arm-restoring">
            <div className="arm-restoring__spinner" />
          </div>
        ) : reg.success && reg.paymentPending ? (
          /* ── Transferencia pendiente ── */
          <div className="arm-pend">
            <div className="arm-pend__status">
              <div className="arm-pend__orbit">
                <div className="arm-pend__ring" />
                <div className="arm-pend__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.2" strokeLinecap="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                </div>
              </div>
              <div className="arm-pend__badge">Verificando pago</div>
            </div>

            <h3 className="arm-pend__title">Registro recibido</h3>
            <p className="arm-pend__sub">
              Tu lugar está reservado. Cuando recepción confirme tu transferencia, tu ticket aparecerá aquí automáticamente.
            </p>

            <div className="arm-pend__chip">
              <span className="arm-pend__chip-label">Ticket</span>
              <span className="arm-pend__chip-num">#{reg.ticketId}</span>
              <span className="arm-pend__chip-sep"/>
              <span className="arm-pend__chip-name">{reg.fullName}</span>
            </div>

            <div className="arm-bank-card arm-bank-card--sm">
              <div className="arm-bank-field">
                <span className="arm-bank-field__label">CLABE Interbancaria</span>
                <div className="arm-bank-field__row">
                  <span className="arm-bank-field__clabe">{HOTEL_CLABE.replace(/(.{4})/g, '$1 ').trim()}</span>
                  <button className={`arm-bank-copy${reg.copiedClabe ? ' arm-bank-copy--ok' : ''}`} onClick={() => {
                    navigator.clipboard.writeText(HOTEL_CLABE)
                    reg.setCopiedClabe(true)
                    setTimeout(() => reg.setCopiedClabe(false), 2200)
                  }}>
                    {reg.copiedClabe ? 'Copiada' : 'Copiar'}
                  </button>
                </div>
              </div>
              <div className="arm-bank-divider"/>
              <div className="arm-bank-row2">
                <div className="arm-bank-field arm-bank-field--half">
                  <span className="arm-bank-field__label">Titular</span>
                  <span className="arm-bank-field__val" style={{ fontSize: '11px' }}>{HOTEL_TITULAR}</span>
                </div>
                {event?.price > 0 && (
                  <div className="arm-bank-field arm-bank-field--half arm-bank-field--right">
                    <span className="arm-bank-field__label">Monto</span>
                    <span className="arm-bank-field__val arm-bank-field__amount">${parseFloat(event.price).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {reg.proofUploaded ? (
              <div className="arm-pend__proof-ok">
                <div className="arm-pend__proof-ok-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="arm-pend__proof-ok-text">
                  <strong>Comprobante enviado</strong>
                  <span>Confirmaremos tu acceso pronto</span>
                </div>
              </div>
            ) : (
              <div className="arm-pend__upload">
                <label className={`arm-pend__dropzone${reg.uploadingProof ? ' arm-pend__dropzone--loading' : ''}`}>
                  {reg.uploadingProof ? 'Subiendo…' : 'Adjuntar comprobante'}
                  <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={reg.handleProofUpload} disabled={reg.uploadingProof} />
                </label>
                {reg.proofError && <p className="arm-pend__upload-error">{reg.proofError}</p>}
              </div>
            )}

            {!reg.joinedGroup && (reg.whatsapp === 'Sí' || (reg.isWhatsappMember !== true && reg.whatsapp !== 'No')) && (
              <button type="button" className="arm-pend__wa" onClick={reg.handleJoinGroup}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Unirme al grupo de WhatsApp
              </button>
            )}

            <div className="arm-pend__waiting">
              <span className="arm-pend__dot"/><span className="arm-pend__dot"/><span className="arm-pend__dot"/>
            </div>
            <button className="arm-success__close-btn" onClick={onClose}>Cerrar</button>
          </div>
        ) : reg.success ? (
          /* ── Registro confirmado (QR) ── */
          <div className="arm-success">
            <div className="arm-success__check">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#838c2f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" fill="#f0f4e8" stroke="none"/>
                <polyline points="20 6 9 17 4 12" stroke="#838c2f"/>
              </svg>
            </div>
            <h3 className="arm-success__title">¡Registro exitoso!</h3>

            <div className="arm-success__ticket">
              <div className="arm-success__ticket-cols">
                <div className="arm-success__ticket-left">
                  <span className="arm-success__ticket-label">Ticket</span>
                  <span className="arm-success__ticket-id">#{reg.ticketId}</span>
                </div>
                <div className="arm-success__ticket-divider"/>
                <div className="arm-success__ticket-right">
                  <span className="arm-success__ticket-event-name">{activity?.name || event?.name}</span>
                  {event?.date && (
                    <span className="arm-success__ticket-date">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {fmtFecha(event.date)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="arm-success__access-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Para acceder al evento presenta este ticket en la entrada.
            </p>

            <div className="arm-success__actions">
              <button
                className={`arm-success__btn arm-success__btn--pdf${reg.downloadingPDF ? ' loading' : ''}`}
                onClick={reg.handleDownloadPDF}
                disabled={reg.downloadingPDF}
              >
                <div className="arm-success__btn-icon">
                  {reg.downloadingPDF ? (
                    <svg className="arm-restoring__spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  )}
                </div>
                <div className="arm-success__btn-label">
                  <span className="arm-success__btn-title">{reg.downloadingPDF ? 'Generando...' : 'Descargar PDF'}</span>
                  <span className="arm-success__btn-sub">Guarda tu ticket</span>
                </div>
              </button>

              <div className="arm-success__wa-row">
                <button
                  type="button"
                  className="arm-success__wa-btn arm-success__wa-btn--ticket arm-success__wa-btn--disabled"
                  disabled
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Recibir ticket
                </button>

                {!reg.joinedGroup && (reg.whatsapp === 'Sí' || (reg.isWhatsappMember !== true && reg.whatsapp !== 'No')) && (
                  <button type="button" className="arm-success__wa-btn arm-success__wa-btn--group" onClick={reg.handleJoinGroup} style={{ border: 'none', outline: 'none' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Unirme al grupo
                  </button>
                )}
              </div>
            </div>

            {/* QR oculto */}
            {reg.registrationId && (
              <QRCodeCanvas
                ref={reg.qrSvgRef}
                value={`https://hotelpuntagaleria.mx/checkin?rid=${reg.registrationId}`}
                size={600}
                level="H"
                style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
              />
            )}

            <div className="arm-success__footer-actions">
              <button className="arm-success__close-btn" onClick={onClose}>Cerrar</button>
              <button
                type="button"
                className="arm-success__new-btn"
                onClick={reg.handleNewRegistration}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Nuevo Registro
              </button>
            </div>
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

            {reg.isWhatsappMember !== true && (
              <div className="arm-field">
                <label className="arm-label">¿Te gustaría unirte al grupo de WhatsApp? *</label>
                <div className="arm-radio-group">
                  {['Sí', 'No'].map(opt => (
                    <label key={opt} className={`arm-radio-label ${reg.whatsapp === opt ? 'arm-radio-label--active' : ''}`}>
                      <input type="radio" name="whatsapp" value={opt} checked={reg.whatsapp === opt}
                        onChange={() => { reg.setWhatsapp(opt); reg.setError('') }} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {reg.isWhatsappMember === true && (
              <div className="arm-wa-member-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Ya estás en el grupo de WhatsApp ✓
              </div>
            )}

            {reg.error && <p className="arm-error">{reg.error}</p>}

            {reg.duplicateReg ? (
              <>
                <div className="arm-duplicate-notice">
                  <span className="arm-duplicate-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </span>
                  <div>
                    <p className="arm-duplicate-title">Este teléfono ya está registrado</p>
                    <p className="arm-duplicate-sub">A nombre de: <strong>{reg.duplicateReg.full_name}</strong> · Ticket #{String(reg.duplicateReg.id).padStart(4, '0')}</p>
                  </div>
                </div>
                <button type="button" className="arm-submit arm-submit--resume" onClick={reg.handleResumeRegistration}>
                  Retomar mi registro →
                </button>
              </>
            ) : (
              <button type="submit" className="arm-submit">
                Continuar al pago →
              </button>
            )}
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
