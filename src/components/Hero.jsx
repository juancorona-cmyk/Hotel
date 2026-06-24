import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CDN } from '../lib/cdn'
import './Hero.css'

export default function Hero({ onBook, promoActive = true, promoConfig = { label: '20% OFF', color: '#b5c840' } }) {
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

        <div className="hero__cta-wrap hero__anim-fade-up hero__anim-delay-2">
          {promoActive && (
            <span className="hero__cta-badge" style={{
              color: promoConfig.color,
              background: `${promoConfig.color}22`,
              borderColor: `${promoConfig.color}55`,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              {t('hero.promoTag')} · {promoConfig.label}
            </span>
          )}
          <button
            type="button"
            className="hero__btn"
            onClick={onBook}
          >
            {t('hero.promoCta')}
            <svg className="hero__btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
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
