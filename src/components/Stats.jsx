import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import './Stats.css'

export default function Stats() {
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

  const stats = [
    { value: '40+',  key: 'stats.anos' },
    { value: '44',   key: 'stats.habitaciones' },
    { value: '500+', key: 'stats.eventos' },
    { value: '4.3★', key: 'stats.calificacion' },
  ]
  return (
    <div className={`stats ${isVisible ? 'is-visible' : ''}`} ref={sectionRef}>
      {stats.map(({ value, key }) => (
        <div key={key} className="stats__item">
          <span className="stats__value">{value}</span>
          <span className="stats__label">{t(key)}</span>
        </div>
      ))}
    </div>
  )
}
