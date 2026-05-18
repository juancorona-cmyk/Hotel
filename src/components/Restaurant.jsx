import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '../lib/turso'
import { CDN } from '../lib/cdn'
import './Restaurant.css'

const SLIDES = [
  CDN.RESTAURANTE_1,
  CDN.RESTAURANTE_2,
  CDN.RESTAURANTE_3,
  CDN.RESTAURANTE_4,
]

export default function Restaurant() {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const [current, setCurrent] = useState(0)
  const sectionRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  // Avance automático cada 5.5 s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % SLIDES.length)
    }, 5500)
    return () => clearInterval(timerRef.current)
  }, [])

  const goTo = (idx) => {
    clearInterval(timerRef.current)
    setCurrent(idx)
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % SLIDES.length)
    }, 5500)
  }

  return (
    <section id="restaurante" className={`restaurant ${isVisible ? 'is-visible' : ''}`} ref={sectionRef}>
      {/* Patrón de fondo — crossfade entre imágenes */}
      {SLIDES.map((src, i) => (
        <div
          key={i}
          className="restaurant__pattern"
          style={{
            backgroundImage: `url(${src})`,
            opacity: i === current ? 0.13 : 0,
          }}
        />
      ))}

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

        {/* Carrusel */}
        <div className="restaurant__carousel">
          <div className="restaurant__slides" style={{ transform: `translateX(-${current * 100}%)` }}>
            {SLIDES.map((src, i) => (
              <img key={i} src={src} alt={`Restaurante ${i + 1}`} className="restaurant__slide" />
            ))}
          </div>

          {/* Puntos de navegación */}
          <div className="restaurant__dots">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                className={`restaurant__dot ${i === current ? 'restaurant__dot--active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Imagen ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
