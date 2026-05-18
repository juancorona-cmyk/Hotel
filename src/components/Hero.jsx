import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CDN } from '../lib/cdn'
import './Hero.css'

export default function Hero({ onBook }) {
  const { t } = useTranslation()
  const [titleNumber, setTitleNumber] = useState(0)
  const [animKey, setAnimKey] = useState(0)

  const titles = useMemo(() => t('hero.titulosDinamicos', { returnObjects: true }), [t])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAnimKey(k => k + 1)
      setTitleNumber(prev => prev === titles.length - 1 ? 0 : prev + 1)
    }, 2500)
    return () => clearTimeout(timeoutId)
  }, [titleNumber, titles.length])

  return (
    <section id="inicio" className="hero">
      <video className="hero__video" src={CDN.VIDEO_FONDO} autoPlay muted loop playsInline loading="lazy" controlsList="nodownload" onContextMenu={e => e.preventDefault()} />
      <div className="hero__overlay" />

      <div className="hero__content">
        <h1 className="hero__title hero__anim-fade-up">
          <span className="hero__title-main">{t('hero.titulo')}</span>
          <span className="hero__title-dynamic">
            <span
              key={animKey}
              className="hero__dynamic-text hero__anim-spring"
            >
              {titles[titleNumber]}
            </span>
          </span>
        </h1>

        <p className="hero__subtitle hero__anim-fade-up hero__anim-delay-1">
          {t('hero.subtitulo')}
        </p>

        <button
          type="button"
          className="hero__btn hero__anim-fade-up hero__anim-delay-2"
          onClick={onBook}
        >
          {t('hero.btn')}
          <svg className="hero__btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <a
        href="#nosotros"
        className="hero__scroll-arrow hero__anim-fade-in hero__anim-delay-3"
        aria-label="Bajar"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </a>
    </section>
  )
}
