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
        {/* Columna izquierda — 2 fotos */}
        <div className="events__col events__col--left">
          <div className="events__photo-wrap">
            <img src={CDN.SALON1} alt="Salón de eventos" className="events__photo" />
          </div>
          <div className="events__photo-wrap">
            <img src={CDN.SALON4} alt="Salón de eventos" className="events__photo" />
          </div>
        </div>

        {/* Centro — foto Nosotros */}
        <div className="events__photo-wrap events__photo-wrap--center">
          <img src={CDN.NOSOTROS} alt="Hotel Punta Galería" className="events__photo" />
        </div>

        {/* Columna derecha — 2 fotos */}
        <div className="events__col events__col--right">
          <div className="events__photo-wrap">
            <img src={CDN.SALON2} alt="Salón de eventos" className="events__photo" />
          </div>
          <div className="events__photo-wrap">
            <img src={CDN.SALON3} alt="Salón de eventos" className="events__photo" />
          </div>
        </div>
      </div>
      <div className="events__desc">
        <p>{t('eventos.desc')}</p>
        <a
          href="https://wa.me/5214433972720?text=Hola,%20me%20gustaría%20reservar%20el%20salón%20de%20eventos"
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
