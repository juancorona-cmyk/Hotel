import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { MoveRight } from 'lucide-react'
import { CDN } from '../lib/cdn'
import './Hero.css'

export default function Hero({ onBook }) {
  const { t } = useTranslation()
  const [titleNumber, setTitleNumber] = useState(0)
  
  // Usamos un array de claves de traducción para los títulos dinámicos
  const titles = useMemo(() => t('hero.titulosDinamicos', { returnObjects: true }), [t])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0)
      } else {
        setTitleNumber(titleNumber + 1)
      }
    }, 2500)
    return () => clearTimeout(timeoutId)
  }, [titleNumber, titles.length])

  return (
    <section id="inicio" className="hero">
      <video className="hero__video" src={CDN.VIDEO_FONDO} autoPlay muted loop playsInline />
      <div className="hero__overlay" />
      
      <div className="hero__content">
        <h1 className="hero__title">
          <span className="hero__title-main">{t('hero.titulo')}</span>
          <span className="hero__title-dynamic">
            <AnimatePresence mode="wait">
              <motion.span
                key={titleNumber}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="hero__dynamic-text"
              >
                {titles[titleNumber]}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>
        
        <p className="hero__subtitle">{t('hero.subtitulo')}</p>
        
        <button type="button" className="hero__btn" onClick={onBook}>
          {t('hero.btn')}
          <MoveRight className="hero__btn-icon" size={18} />
        </button>
      </div>

      <a href="#nosotros" className="hero__scroll-arrow" aria-label="Bajar">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </a>
    </section>
  )
}
