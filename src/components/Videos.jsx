import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CDN } from '../lib/cdn'
import './Videos.css'

export default function Videos() {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const [active, setActive] = useState(null)   // video abierto en el reproductor grande
  const sectionRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const onKey = (e) => { if (e.key === 'Escape') setActive(null) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [active])

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
              <button type="button" className="vambient__media" onClick={() => setActive(v)} aria-label={`Ver ${v.badge} en grande`}>
                <video
                  src={v.src}
                  className="vambient__video"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  onContextMenu={e => e.preventDefault()}
                />
                <div className="vambient__overlay" />
                <span className="vambient__play" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M8 5v14l11-7z"/></svg>
                </span>
              </button>
              <span className="vambient__badge">{v.badge}</span>
              <div className="vambient__info">
                <h3>{t(v.titleKey)}</h3>
                <p>{t(v.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {active && (
        <div className="vmodal-overlay" onMouseDown={e => e.target === e.currentTarget && setActive(null)}>
          <div className="vmodal">
            <button className="vmodal__close" onClick={() => setActive(null)} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="22" height="22">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <video
              src={active.src}
              className="vmodal__video"
              controls
              autoPlay
              loop
              playsInline
              controlsList="nodownload nofullscreen"
              disablePictureInPicture
              onContextMenu={e => e.preventDefault()}
              onDoubleClick={e => e.preventDefault()}
            />
            <div className="vmodal__caption">
              <span className="vmodal__badge">{active.badge}</span>
              <h3>{t(active.titleKey)}</h3>
              <p>{t(active.descKey)}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
