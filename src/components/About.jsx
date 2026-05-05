import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { CDN } from '../lib/cdn'
import './About.css'

export default function About() {
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
    <section id="nosotros" className={`about ${isVisible ? 'is-visible' : ''}`} ref={sectionRef}>
      <div className="about__inner">
        <div className="about__text">
          <div className="about__logo-wrap">
            <img src="/logo/logo.svg" alt="Hotel Punta Galería" className="about__logo" />
          </div>
          <p className="about__lead">{t('nosotros.lead')}</p>
          <p>{t('nosotros.p1')}</p>
          <p>{t('nosotros.p2')}</p>
        </div>
        <div className="about__image-wrap">
          <img src={CDN.FOTO_INICIO} alt="Hotel Punta Galería jardines" className="about__image" />
        </div>
      </div>
    </section>
  )
}
