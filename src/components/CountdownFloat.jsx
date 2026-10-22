import { useState, useEffect } from 'react'
import './CountdownFloat.css'

function timeLeftToday() {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const diff = Math.max(0, end - now)
  return {
    h: String(Math.floor(diff / 3_600_000)).padStart(2, '0'),
    m: String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0'),
    s: String(Math.floor((diff % 60_000) / 1000)).padStart(2, '0'),
  }
}

export default function CountdownFloat({ onBook, config = {} }) {
  const [time, setTime] = useState(timeLeftToday())
  const [isMobile, setIsMobile] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTime(timeLeftToday()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const color = config.countdownColor || '#5a6c1e'
  const text = config.countdownText || 'Reserva hoy y llévate el desayuno incluido gratis (2 personas)'

  if (isMobile && !expanded) {
    return (
      <button
        type="button"
        className="cdf-tab"
        style={{ '--cdf-color': color }}
        onClick={() => setExpanded(true)}
        aria-label="Ver oferta por tiempo limitado"
      >
        <span className="cdf-tab__icon">🔥</span>
        <span className="cdf-tab__text">OFERTA</span>
      </button>
    )
  }

  return (
    <div className={`cdf ${isMobile ? 'cdf--mobile' : ''}`} style={{ '--cdf-color': color }}>
      {isMobile && (
        <button type="button" className="cdf__close" onClick={() => setExpanded(false)} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
      <p className="cdf__eyebrow">🔥 OFERTA POR TIEMPO LIMITADO</p>
      <p className="cdf__headline">{text}</p>

      <div className="cdf__segments">
        <div className="cdf__seg">
          <span className="cdf__num">{time.h}</span>
          <span className="cdf__unit">horas</span>
        </div>
        <span className="cdf__colon">:</span>
        <div className="cdf__seg">
          <span className="cdf__num">{time.m}</span>
          <span className="cdf__unit">min</span>
        </div>
        <span className="cdf__colon">:</span>
        <div className="cdf__seg">
          <span className="cdf__num">{time.s}</span>
          <span className="cdf__unit">seg</span>
        </div>
      </div>

      <p className="cdf__caption">Termina hoy a medianoche</p>

      <button type="button" className="cdf__cta" onClick={onBook}>
        Reservar ahora
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </div>
  )
}
