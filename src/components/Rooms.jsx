import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CDN } from '../lib/cdn'
import './Rooms.css'

const icons = {
  personas: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  cama:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M2 12V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/><path d="M2 20h20M2 8h20"/></svg>,
  camas2:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M2 12V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v4"/><path d="M11 12V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v4"/><path d="M2 20h20M2 8h20"/></svg>,
  ac:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="5" width="22" height="9" rx="2"/><path d="M8 19H5a2 2 0 0 1-2-2v-3"/><path d="M16 19h3a2 2 0 0 0 2-2v-3"/><path d="M12 14v5"/></svg>,
  wifi:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>,
  tv:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 20h8M12 18v2"/></svg>,
  desk:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="9" width="20" height="3" rx="1"/><path d="M5 12v7M19 12v7M5 19h14M9 9V5h6v4"/></svg>,
}

export default function Rooms({ onBook }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef(null)
  const touchStartX = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev()
    touchStartX.current = null
  }

  const rooms = [
    {
      id: 'deluxe',
      name: 'Deluxe',
      image: CDN.DELUXE,
      features: [
        { icon: icons.personas, key: 'habitaciones.personas1' },
        { icon: icons.cama,     key: 'habitaciones.kingSize' },
        { icon: icons.ac,       key: 'habitaciones.ac' },
        { icon: icons.wifi,     key: 'habitaciones.wifi' },
        { icon: icons.tv,       key: 'habitaciones.tv' },
        { icon: icons.desk,     key: 'habitaciones.escritorio' },
      ],
    },
    {
      id: 'doble',
      name: 'Doble',
      image: CDN.DELUXE_DOUBLE,
      features: [
        { icon: icons.personas, key: 'habitaciones.personas2' },
        { icon: icons.camas2,   key: 'habitaciones.dosMatrimoniales' },
        { icon: icons.ac,       key: 'habitaciones.ac' },
        { icon: icons.wifi,     key: 'habitaciones.wifi' },
        { icon: icons.tv,       key: 'habitaciones.tv' },
        { icon: icons.desk,     key: 'habitaciones.escritorio' },
      ],
    },
  ]

  const prev = () => setCurrent((c) => (c - 1 + rooms.length) % rooms.length)
  const next = () => setCurrent((c) => (c + 1) % rooms.length)
  const room = rooms[current]

  return (
    <section id="habitaciones" className={`rooms ${isVisible ? 'is-visible' : ''}`} ref={sectionRef}>
      <video
        className="rooms__video-bg"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src={CDN.VIDEO_HABITACION} type="video/mp4" />
      </video>
      <div className="rooms__overlay"></div>

      <h2 className="rooms__section-title">{t('habitaciones.titulo')}</h2>

      <div className="rooms__slider-wrap">
        <button className="rooms__arrow rooms__arrow--left" onClick={prev} aria-label="Anterior">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div className="rooms__card" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="rooms__image-wrap">
            <img src={room.image} alt={room.name} className="rooms__image" />
          </div>
          <div className="rooms__info">
            <p className="rooms__label">{t('habitaciones.label')}</p>
            <h3 className="rooms__name">{room.name}</h3>
            <ul className="rooms__features">
              {room.features.map(({ icon, key }) => (
                <li key={key}>
                  <div className="rooms__feat-icon">{icon}</div>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="rooms__btn"
              onClick={() => onBook(room.id)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.562 4.13 1.541 5.858L.057 23.486a.5.5 0 0 0 .614.614l5.628-1.484A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.031-1.362l-.36-.214-3.736.985.985-3.736-.214-.36A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              {t('habitaciones.btn')}
            </button>
          </div>
        </div>

        <button className="rooms__arrow rooms__arrow--right" onClick={next} aria-label="Siguiente">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div className="rooms__dots">
        {rooms.map((r, i) => (
          <button key={r.id}
            className={`rooms__dot ${i === current ? 'rooms__dot--active' : ''}`}
            onClick={() => setCurrent(i)}
            aria-label={`${i + 1}`} />
        ))}
      </div>
    </section>
  )
}
