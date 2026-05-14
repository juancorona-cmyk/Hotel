import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '../lib/turso'
import { CDN } from '../lib/cdn'
import './Restaurant.css'

export default function Restaurant() {
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
    <section id="restaurante" className={`restaurant ${isVisible ? 'is-visible' : ''}`} ref={sectionRef}>
      <div className="restaurant__inner">
        <div className="restaurant__text">
          <h2 className="restaurant__title">{t('restaurante.titulo')}</h2>
          <p>{t('restaurante.p1')}</p>
          <p>
            {t('restaurante.p2Inicio')}
            <strong>{t('restaurante.p2Bold')}</strong>
            {t('restaurante.p2Fin')}
          </p>
          <a
            href="https://wa.me/5214433972720?text=Hola,%20me%20gustaría%20ver%20el%20menú%20del%20restaurante"
            target="_blank"
            rel="noopener noreferrer"
            className="restaurant__btn"
            onClick={() => trackEvent('whatsapp_click', { source: 'restaurante' })}
          >
            {t('restaurante.btn')}
          </a>
        </div>
        <div className="restaurant__image-wrap">
          <img src={CDN.RESTAURANTE} alt="Restaurante" className="restaurant__image" />
        </div>
      </div>
    </section>
  )
}
