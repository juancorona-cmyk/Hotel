import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CDN } from '../lib/cdn'
import './Videos.css'

export default function Videos() {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef(null)

  const videos = [
    { src: CDN.VIDEO_FONDO,      titleKey: 'videos.v1titulo', descKey: 'videos.v1desc', badge: 'Entorno' },
    { src: CDN.VIDEO_JARDINES,   titleKey: 'videos.v2titulo', descKey: 'videos.v2desc', badge: 'Jardines' },
    { src: CDN.VIDEO_HABITACION, titleKey: 'videos.v3titulo', descKey: 'videos.v3desc', badge: 'Habitaciones' },
  ]

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
    <section id="videos" className={`videos ${isVisible ? 'is-visible' : ''}`} ref={sectionRef}>
      <div className="videos__inner">
        <p className="videos__eyebrow">{t('videos.eyebrow')}</p>
        <h2 className="videos__title">{t('videos.titulo')}</h2>
        <div className="videos__grid">
          {videos.map((v) => (
            <div key={v.src} className="vambient">
              <div className="vambient__media">
                <video
                  src={v.src}
                  className="vambient__video"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
                <div className="vambient__overlay" />
              </div>
              <span className="vambient__badge">{v.badge}</span>
              <div className="vambient__info">
                <h3>{t(v.titleKey)}</h3>
                <p>{t(v.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
