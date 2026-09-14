import { useState, useEffect } from 'react'
import './CountdownBanner.css'

function timeLeftToday() {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const diff = Math.max(0, end - now)
  const h = String(Math.floor(diff / 3_600_000)).padStart(2, '0')
  const m = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0')
  const s = String(Math.floor((diff % 60_000) / 1000)).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function CountdownBanner({ onBook, config = {} }) {
  const [time, setTime] = useState(timeLeftToday())

  useEffect(() => {
    const id = setInterval(() => setTime(timeLeftToday()), 1000)
    return () => clearInterval(id)
  }, [])

  const color = config.countdownColor || '#5a6c1e'
  const text = config.countdownText || 'Reserva hoy y llévate el desayuno incluido gratis'

  return (
    <div className="cdb" role="banner" onClick={onBook} style={{ background: color }}>
      <span className="cdb__icon" aria-hidden="true">⏱</span>
      <span className="cdb__text">{text}</span>
      <span className="cdb__sep" aria-hidden="true">·</span>
      <span className="cdb__label">Termina en</span>
      <span className="cdb__time">{time}</span>
    </div>
  )
}
