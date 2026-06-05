import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import DateRangePicker from './DateRangePicker'
import { trackEvent } from '../lib/turso'
import './BookingModal.css'

const today = () => new Date().toISOString().split('T')[0]
const addDays = (dateStr, n) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
const nightsBetween = (a, b) => {
  if (!a || !b) return 0
  const diff = (new Date(b) - new Date(a)) / 86400000
  return diff > 0 ? diff : 0
}

function Counter({ value, onChange, min = 0, max = 10 }) {
  return (
    <div className="bm-counter">
      <button type="button" className="bm-counter__btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Reducir">−</button>
      <span className="bm-counter__val">{value}</span>
      <button type="button" className="bm-counter__btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Aumentar">+</button>
    </div>
  )
}

export default function BookingModal({ initialRoom, onClose }) {
  const { t, i18n } = useTranslation()

  const ROOMS = [
    { id: 'deluxe', name: t('modal.deluxe'), maxAdults: 2, maxChildren: 0, label: t('modal.habDeluxe') },
    { id: 'doble',  name: t('modal.doble'),  maxAdults: 4, maxChildren: 2, label: t('modal.habDoble') },
  ]

  const fmtDate = (str) => {
    if (!str) return ''
    const [y, m, d] = str.split('-')
    const meses = t('drp.mesesCorto', { returnObjects: true })
    return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
  }

  const defaultRoom = ROOMS.find(r => r.id === initialRoom) || ROOMS[0]

  const [roomId,   setRoomId]   = useState(defaultRoom.id)
  const [checkin,  setCheckin]  = useState(today())
  const [checkout, setCheckout] = useState(addDays(today(), 1))
  const [adults,   setAdults]   = useState(1)
  const [children, setChildren] = useState(0)
  const [rooms,    setRooms]    = useState(1)

  const room         = ROOMS.find(r => r.id === roomId)
  const nights       = nightsBetween(checkin, checkout)
  const extraPersons = Math.max(0, adults - room.maxAdults * rooms)

  useEffect(() => {
    if (adults > room.maxAdults)     setAdults(room.maxAdults)
    if (children > room.maxChildren) setChildren(0)
  }, [roomId])

  const handleClose = useCallback((e) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!checkin || !checkout) return
    // Folio = firma para identificar que el prospecto vino de la página web y cruzarlo en métricas
    const folio = 'HPG-' + Date.now().toString(36).toUpperCase().slice(-6)
    trackEvent('reserva_confirmada', { source: 'booking_modal', origin: 'web', folio, room: roomId, nights, adults, children, rooms, checkin, checkout })
    const lines = [
      t('modal.waMsg.hola'),
      ``,
      `🏨 ${t('modal.waMsg.habitacion')}: ${room.name} (${room.label})`,
      `📅 ${t('modal.waMsg.llegada')}: ${fmtDate(checkin)}`,
      `📅 ${t('modal.waMsg.salida')}: ${fmtDate(checkout)} (${nights} ${t(nights === 1 ? 'modal.noche' : 'modal.noches')})`,
      `👤 ${t('modal.adultosLbl')}: ${adults}`,
      ...(room.maxChildren > 0 ? [`👶 ${t('modal.ninosLbl')}: ${children}`] : []),
      `🛏 ${t('modal.habitacionesLbl')}: ${rooms}`,
      ...(extraPersons > 0 ? [`⚠️ Cargo adicional: ${extraPersons} persona${extraPersons > 1 ? 's' : ''} extra × $200 = $${extraPersons * 200} MXN por noche`] : []),
      ``,
      t('modal.waMsg.gracias'),
      `——————`,
      `🔖 ${t('modal.waMsg.folio')}: ${folio}`,
      `🌐 ${t('modal.waMsg.firma')}`,
    ].join('\n')
    window.open(`https://wa.me/5214433972720?text=${encodeURIComponent(lines)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="bm-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label={t('modal.titulo')}>
      <div className="bm-card">

        {/* Header */}
        <div className="bm-header">
          <div className="bm-header__left">
            <span className="bm-header__eyebrow">HOTEL PUNTA GALERÍA</span>
            <h2 className="bm-header__title">{t('modal.titulo')}</h2>
          </div>
          <button className="bm-close" onClick={onClose} aria-label={t('drp.borrar')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form className="bm-form" onSubmit={handleSubmit}>

          {/* Room type */}
          <div className="bm-section">
            <p className="bm-label">{t('modal.tipoHabitacion')}</p>
            <div className="bm-room-tabs">
              {ROOMS.map(r => (
                <button
                  key={r.id} type="button"
                  className={`bm-room-tab ${roomId === r.id ? 'bm-room-tab--active' : ''}`}
                  onClick={() => setRoomId(r.id)}
                >
                  <span className="bm-room-tab__name">{r.name}</span>
                  <span className="bm-room-tab__sub">{r.label}</span>
                  <span className="bm-room-tab__cap">
                    {r.maxAdults} {t(r.maxAdults === 1 ? 'modal.adulto' : 'modal.adultos')}
                    {r.maxChildren > 0 ? ` · ${t('modal.hastaNinos', { count: r.maxChildren })}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Dates — custom range picker */}
          <div className="bm-section">
            <p className="bm-label">{t('modal.fechas')}</p>
            <DateRangePicker
              checkin={checkin}
              checkout={checkout}
              onChange={(ci, co) => { setCheckin(ci); setCheckout(co) }}
              minDate={today()}
            />
            {nights > 0 && (
              <p className="bm-nights-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                {nights} {t(nights === 1 ? 'modal.noche' : 'modal.noches')}
              </p>
            )}
          </div>

          {/* Guests + Rooms */}
          <div className="bm-section">
            <p className="bm-label">{t('modal.huespedesYHabitaciones')}</p>
            <div className="bm-counters">
              <div className="bm-counter-row">
                <div className="bm-counter-info">
                  <span className="bm-counter-name">{t('modal.adultosLbl')}</span>
                  <span className="bm-counter-sub">{t('modal.maxPorHabitacion', { count: room.maxAdults })}</span>
                </div>
                <Counter value={adults} onChange={setAdults} min={1} max={room.maxAdults * rooms + 4} />
              </div>
              {room.maxChildren > 0 && (
                <div className="bm-counter-row">
                  <div className="bm-counter-info">
                    <span className="bm-counter-name">{t('modal.ninosLbl')}</span>
                    <span className="bm-counter-sub">{t('modal.maxPorHabitacion', { count: room.maxChildren })}</span>
                  </div>
                  <Counter value={children} onChange={setChildren} min={0} max={room.maxChildren * rooms} />
                </div>
              )}
              <div className="bm-counter-row">
                <div className="bm-counter-info">
                  <span className="bm-counter-name">{t('modal.habitacionesLbl')}</span>
                  <span className="bm-counter-sub">{t('modal.sujetaConfirmacion')}</span>
                </div>
                <Counter value={rooms} onChange={setRooms} min={1} max={5} />
              </div>
            </div>
            {extraPersons > 0 && (
              <div className="bm-extra-notice">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>
                  {extraPersons} persona{extraPersons > 1 ? 's' : ''} adicional{extraPersons > 1 ? 'es' : ''} · <strong>$200 extra c/u por noche</strong>
                </span>
              </div>
            )}
          </div>

          {/* Summary + CTA */}
          <div className="bm-footer">
            <div className="bm-summary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>
                {rooms} {t('modal.habitacionesLbl').toLowerCase().slice(0, 3)}. · {adults} {t(adults === 1 ? 'modal.adulto' : 'modal.adultos')}
                {children > 0 ? ` · ${children} ${t(children === 1 ? 'modal.nino' : 'modal.ninos')}` : ''}
                {nights > 0 ? ` · ${nights} ${t(nights === 1 ? 'modal.noche' : 'modal.noches')}` : ''}
              </span>
            </div>
            <button type="submit" className="bm-submit" disabled={!checkin || !checkout}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.562 4.13 1.541 5.858L.057 23.486a.5.5 0 0 0 .614.614l5.628-1.484A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.031-1.362l-.36-.214-3.736.985.985-3.736-.214-.36A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              {t('modal.confirmarBtn')}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
