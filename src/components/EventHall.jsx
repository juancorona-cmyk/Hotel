import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '../lib/turso'
import { CDN } from '../lib/cdn'
import './EventHall.css'

export default function EventHall() {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section id="eventos" className={`events ${isVisible ? 'is-visible' : ''}`} ref={sectionRef}>
      <h2 className="events__title">{t('eventos.titulo')}</h2>
      <div className="events__gallery">
        <div className="events__photo-wrap events__photo-wrap--left">
          <img src={CDN.SALON1} alt="Salón de eventos" className="events__photo" />
        </div>
        <div className="events__photo-wrap events__photo-wrap--center">
          <img src={CDN.SALON_PRINCIPAL} alt="Salón principal" className="events__photo" />
        </div>
        <div className="events__photo-wrap events__photo-wrap--right-top">
          <img src={CDN.SALON2} alt="Salón de eventos" className="events__photo" />
        </div>
        <div className="events__photo-wrap events__photo-wrap--right-bottom">
          <img src={CDN.SALON3} alt="Salón de eventos" className="events__photo" />
        </div>
      </div>
      <div className="events__desc">
        <p>{t('eventos.desc')}</p>
        <a
          href="https://wa.me/5214431234567?text=Hola,%20me%20gustaría%20reservar%20el%20salón%20de%20eventos"
          target="_blank" rel="noopener noreferrer"
          className="events__btn"
          onClick={() => trackEvent('whatsapp_click', { source: 'salon' })}
        >
          {t('eventos.btn')}
        </a>
      </div>
    </section>
  )
}
