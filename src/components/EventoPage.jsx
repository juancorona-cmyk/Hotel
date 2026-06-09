import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { getEventBySlug, trackEvent } from '../lib/turso'
import { fmtFecha } from '../lib/utils'
import { HOTEL_CLABE, HOTEL_TITULAR, HOTEL_WHATSAPP_URL } from '../lib/registrationConstants'
import { useRegistration, WHATSAPP_OPTIONS, HOW_FOUND_OPTIONS } from '../hooks/useRegistration'
import './EventoPage.css'

export default function EventoPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  const onRegistered = useCallback((regId) => {
    navigate(`/evento/${slug}?rid=${regId}`, { replace: true })
  }, [navigate, slug])

  const reg = useRegistration({
    event,
    initialRegId: searchParams.get('rid'),
    onRegistered,
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const ev = await getEventBySlug(slug)
      setEvent(ev)
      if (ev?.id) {
        trackEvent('activity_reg_intent', { event_id: ev.id, event_name: ev.name, source: 'link' })
      }
      setLoading(false)
    }
    load()
  }, [slug])

  // Lock body scroll on mobile for single-view states
  useEffect(() => {
    if (window.innerWidth > 760) return
    const isSingleView = !loading && (reg.success || reg.isSoldOut)
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
  }, [loading, reg.success, reg.isSoldOut])

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
            <button className="ep-back" onClick={() => navigate('/#eventos')}>← Volver al inicio</button>
            <div className="ep-not-found">
              <div className="ep-not-found__icon">🌴</div>
              <h2>Evento no disponible</h2>
              <p>El evento que buscas no existe o ya no está activo.</p>
              <button className="ep-back-btn" onClick={() => navigate('/#eventos')}>Ir al inicio</button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="ep-header">
        <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ep-logo" />
      </header>

      <div className={`ep-page${reg.success || reg.isSoldOut ? ' ep-page--done' : ''}`}>
        <div className="ep-container">

          <button className="ep-back" onClick={() => navigate('/#eventos')}>← Volver al inicio</button>

          <div className="ep-grid">

            {/* ── Col 1: form / soldout / success ── */}
            <div className="ep-col-form">
              {reg.isSoldOut ? (
                <div className="ep-soldout">
                  <div className="ep-soldout__icon">🌴</div>
                  <h2>¡Lugares agotados!</h2>
                  <p>Este evento está lleno. Mantente al tanto de próximos eventos en nuestras redes.</p>
                  <a href={HOTEL_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="ep-soldout__wa">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Avisarme del próximo evento
                  </a>
                </div>
              ) : reg.success && reg.paymentPending ? (
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
                  {reg.registrationId && (
                    <div className="ep-pend__chip">
                      <span className="ep-pend__chip-label">Ticket</span>
                      <span className="ep-pend__chip-num">#{reg.ticketId}</span>
                      <span className="ep-pend__chip-sep"/>
                      <span className="ep-pend__chip-name">{reg.fullName}</span>
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
                          className={`ep-pend__copy${reg.copiedClabe ? ' ep-pend__copy--ok' : ''}`}
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(HOTEL_CLABE) } catch {}
                            reg.setCopiedClabe(true)
                            setTimeout(() => reg.setCopiedClabe(false), 2200)
                          }}
                        >
                          {reg.copiedClabe
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          }
                          {reg.copiedClabe ? 'Copiada' : 'Copiar'}
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
                  {reg.proofUploaded ? (
                    <>
                      <div className="ep-pend__proof-ok">
                        <div className="ep-pend__proof-ok-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <div className="ep-pend__proof-ok-text">
                          <strong>Comprobante enviado</strong>
                          <span>Lo verificaremos y confirmaremos tu acceso pronto</span>
                        </div>
                      </div>
                      {!reg.joinedGroup && (reg.whatsapp === 'Sí' || (reg.isWhatsappMember !== true && reg.whatsapp !== 'No')) && reg.registrationId && (
                        <button
                          type="button"
                          className="ep-group-btn"
                          onClick={reg.handleJoinGroup}
                          style={{ width: '100%', marginTop: '12px', border: 'none', outline: 'none' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          Unirme al grupo de WhatsApp
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="ep-pend__upload">
                      <label className={`ep-pend__dropzone${reg.uploadingProof ? ' ep-pend__dropzone--loading' : ''}`}>
                        {reg.uploadingProof ? (
                          <>
                            <svg className="ep-pend__upload-spin" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                            <span className="ep-pend__dropzone-main">Subiendo comprobante…</span>
                          </>
                        ) : (
                          <>
                            <div className="ep-pend__dropzone-icon">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            </div>
                            <span className="ep-pend__dropzone-main">Adjunta tu comprobante</span>
                            <span className="ep-pend__dropzone-sub">Imagen o PDF · Toca para seleccionar</span>
                          </>
                        )}
                        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={reg.handleProofUpload} disabled={reg.uploadingProof} />
                      </label>
                      {reg.proofError && <p className="ep-error">{reg.proofError}</p>}
                    </div>
                  )}

                  {/* Waiting indicator */}
                  <div className="ep-pend__waiting">
                    <span className="ep-pend__waiting-dot"/><span className="ep-pend__waiting-dot"/><span className="ep-pend__waiting-dot"/>
                    <span>Esperando confirmación de recepción</span>
                  </div>

                  <a
                    href={`https://wa.me/526677154727?text=${encodeURIComponent(
                      `Hola, me registré para *${event?.name}*. Mi ticket es #${reg.ticketId} a nombre de ${reg.fullName}. Ya realicé mi transferencia — ¿me pueden avisar cuando confirmen mi pago?`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ep-pend__wa"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Avisarme cuando confirmen mi pago
                  </a>

                  <button className="ep-back-btn" onClick={() => navigate('/#eventos')}>
                    Volver al inicio
                  </button>
                </div>

              ) : reg.success ? (
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

                  {reg.registrationId && (
                    <div className="ep-ticket-qr">
                      <QRCodeSVG
                        value={`https://hotelpuntagaleria.mx/checkin?rid=${reg.registrationId}`}
                        size={180}
                        level="H"
                        includeMargin={true}
                        style={{ borderRadius: 12 }}
                      />
                      {/* Canvas oculto para PDF — toDataURL() fiable */}
                      <QRCodeCanvas
                        ref={reg.qrSvgRef}
                        value={`https://hotelpuntagaleria.mx/checkin?rid=${reg.registrationId}`}
                        size={600}
                        level="H"
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: 0, left: 0 }}
                      />
                      <div className="ep-ticket-meta">
                        <span className="ep-ticket-num">TICKET #{reg.ticketId}</span>
                        <span className="ep-ticket-name">{reg.fullName}</span>
                        {event?.name && <span className="ep-ticket-event">{event.name}</span>}
                      </div>
                    </div>
                  )}

                  <div className="ep-success-actions">
                    {reg.registrationId && (
                      <button
                        className={`ep-share__pdf${reg.downloadingPDF ? ' ep-share__pdf--loading' : ''}`}
                        onClick={reg.handleDownloadPDF}
                        disabled={reg.downloadingPDF}
                        style={{ width: '100%' }}
                      >
                        {reg.downloadingPDF ? (
                          <><svg className="ep-share__pdf-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>Generando PDF…</>
                        ) : (
                          <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>Descargar PDF</>
                        )}
                      </button>
                    )}
                    
                    <div className="ep-wa-row">
                      {reg.registrationId && (
                        <button
                          type="button"
                          className="ep-share__wa ep-share__wa--disabled"
                          disabled
                          style={{ background: '#bbbbbb', opacity: 0.7, cursor: 'not-allowed', pointerEvents: 'none', border: 'none', padding: '12px' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          Recibir ticket
                        </button>
                      )}

                      {!reg.joinedGroup && (reg.whatsapp === 'Sí' || (reg.isWhatsappMember !== true && reg.whatsapp !== 'No')) && reg.registrationId && (
                        <button
                          type="button"
                          className="ep-group-btn"
                          onClick={reg.handleJoinGroup}
                          style={{ border: 'none', outline: 'none' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          Unirme al grupo
                        </button>
                      )}
                    </div>
                    <button className="ep-back-btn" onClick={() => navigate('/#eventos')} style={{ marginTop: '8px' }}>Volver al inicio</button>
                  </div>
                </div>
              ) : reg.restoring ? (
                <div className="ep-restoring">
                  <div className="ep-spinner"/>
                </div>
              ) : reg.step === 1 ? (
                <div className="ep-form-wrap">
                  <div className="ep-steps">
                    <span className="ep-step ep-step--active">1</span>
                    <span className="ep-step-line"/>
                    <span className="ep-step">2</span>
                  </div>
                  <h2 className="ep-form-title">Tus datos</h2>

                  <form onSubmit={reg.handleStep1} className="ep-form">
                    <div className="ep-field">
                      <label className="ep-label">Nombre completo *</label>
                      <input
                        type="text"
                        className="ep-input"
                        value={reg.fullName}
                        onChange={e => { reg.setFullName(e.target.value); reg.setError('') }}
                        placeholder="Tu nombre completo"
                      />                    </div>

                    <div className="ep-field">
                      <label className="ep-label">Número de teléfono *</label>
                      <input
                        type="tel"
                        className={`ep-input${reg.phoneOk ? ' ep-input--ok' : reg.phoneBad ? ' ep-input--error' : ''}`}
                        value={reg.phone}
                        onChange={e => { reg.setPhone(e.target.value); reg.setError('') }}
                        placeholder="Ej: 667 123 4567"
                      />
                      {reg.phoneBad && <p className="ep-phone-hint">Ej: 667 123 4567 · +1 555 000 1234 · +52 667 123 4567</p>}
                    </div>

                    <div className="ep-field">
                      <label className="ep-label">¿Cómo te enteraste del evento? *</label>
                      <div className="ep-radio-group">
                        {HOW_FOUND_OPTIONS.map(opt => (
                          <label key={opt} className={`ep-radio-label${reg.howFound === opt ? ' ep-radio-label--active' : ''}`}>
                            <input type="radio" name="howFound" value={opt} checked={reg.howFound === opt}
                              onChange={() => { reg.setHowFound(opt); reg.setError('') }} />
                            {opt}
                          </label>
                        ))}
                      </div>
                      {reg.howFound === 'Otros' && (
                        <input type="text" className="ep-input ep-input--sm"
                          value={reg.howFoundOther} onChange={e => reg.setHowFoundOther(e.target.value)}
                          placeholder="¿Cuál?" style={{ marginTop: 8 }} />
                      )}
                    </div>

                    {reg.isWhatsappMember !== true && (
                      <div className="ep-field">
                        <label className="ep-label">¿Te gustaría unirte al grupo de WhatsApp? *</label>
                        <div className="ep-radio-group">
                          {['Sí', 'No'].map(opt => (
                            <label key={opt} className={`ep-radio-label${reg.whatsapp === opt ? ' ep-radio-label--active' : ''}`}>
                              <input type="radio" name="whatsapp" value={opt} checked={reg.whatsapp === opt}
                                onChange={() => { reg.setWhatsapp(opt); reg.setError('') }} />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {reg.isWhatsappMember === true && (
                      <div className="ep-wa-member-notice">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Ya estás en el grupo de WhatsApp ✓
                      </div>
                    )}

                    {reg.error && <p className="ep-error">{reg.error}</p>}

                    {reg.duplicateReg ? (
                      <>
                        <div className="ep-duplicate-notice">
                          <span className="ep-duplicate-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          </span>
                          <div>
                            <p className="ep-duplicate-title">Este teléfono ya está registrado</p>
                            <p className="ep-duplicate-sub">A nombre de: <strong>{reg.duplicateReg.full_name}</strong> · Ticket #{String(reg.duplicateReg.id).padStart(4, '0')}</p>
                          </div>
                        </div>
                        <button type="button" className="ep-submit ep-submit--resume" onClick={reg.handleResumeRegistration}>
                          Retomar mi registro →
                        </button>
                      </>
                    ) : (
                      <button type="submit" className="ep-submit">
                        Continuar al pago →
                      </button>
                    )}
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

                  {reg.showTransferInfo ? (
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
                            className={`ep-pend__copy${reg.copiedClabe ? ' ep-pend__copy--ok' : ''}`}
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(HOTEL_CLABE) } catch {}
                              reg.setCopiedClabe(true)
                              setTimeout(() => reg.setCopiedClabe(false), 2200)
                            }}
                          >
                            {reg.copiedClabe
                              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          }
                          {reg.copiedClabe ? 'Copiada' : 'Copiar'}
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
                        onClick={() => reg.handlePayment('transferencia')}
                        disabled={reg.submitting}
                      >
                        {reg.submitting ? 'Registrando…' : 'Confirmar registro'}
                      </button>
                      <button type="button" className="ep-back-btn" onClick={() => reg.setShowTransferInfo(false)} style={{ marginTop: 8 }}>
                        ← Regresar
                      </button>
                    </div>
                  ) : (
                  <div className="ep-pay-options">
                    <button
                      type="button"
                      className="ep-pay-card"
                      onClick={() => reg.setShowTransferInfo(true)}
                      disabled={reg.submitting}
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
                      onClick={() => reg.handlePayment('presencial')}
                      disabled={reg.submitting}
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

                    <button type="button" className="ep-pay-card ep-pay-card--disabled" disabled aria-disabled="true">
                      <div className="ep-pay-card__icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                        </svg>
                      </div>
                      <div className="ep-pay-card__info">
                        <strong>Pago con tarjeta</strong>
                        <span>Próximamente</span>
                      </div>
                      <span className="ep-pay-soon">No disponible</span>
                    </button>
                  </div>
                  )}

                  {reg.error && <p className="ep-error" style={{ marginTop: 12 }}>{reg.error}</p>}
                  {reg.submitting && <p style={{ textAlign:'center', color:'#888', fontSize:13, marginTop:12 }}>Registrando…</p>}

                  {!reg.showTransferInfo && (
                    <button type="button" className="ep-back-btn" onClick={() => reg.setStep(1)} style={{ marginTop: 16 }}>
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
                {reg.capacity > 0 && (
                  <div className="ep-pill ep-pill--spots" style={{ borderColor: reg.spotsColor, color: reg.spotsColor }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    {reg.spotsLeft === null
                      ? `${reg.capacity} lugares`
                      : reg.isSoldOut
                        ? 'Sin lugares disponibles'
                        : reg.spotsLeft <= 3
                          ? `¡Solo ${reg.spotsLeft} lugar${reg.spotsLeft === 1 ? '' : 'es'}!`
                          : `${reg.spotsLeft} de ${reg.capacity} disponibles`
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
