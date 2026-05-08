import { useState, useEffect } from 'react'

const ADMIN_CODE = '171215'

export default function MaintenanceBanner({ show = true, onUnlock, skip = false }) {
  const [code, setCode] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unlocked = sessionStorage.getItem('maintenance_unlocked')
    if (unlocked === 'true') {
      setIsUnlocked(true)
      if (onUnlock) onUnlock()
    }
  }, [onUnlock])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (code === ADMIN_CODE) {
      setIsUnlocked(true)
      sessionStorage.setItem('maintenance_unlocked', 'true')
      setError('')
      setCode('')
      if (onUnlock) onUnlock()
    } else {
      setError('Código incorrecto')
      setCode('')
    }
  }

  if (!show || isUnlocked || skip) return null

  return (
    <div className="maintenance-lock">
      <div className="maintenance-lock__bg" />
      <div className="maintenance-lock__container">
        <div className="maintenance-lock__card">
          {/* Lock Icon */}
          <svg className="maintenance-lock__icon" viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
            <path d="M12 1C5.9 1 1 5.9 1 12s4.9 11 11 11 11-4.9 11-11S18.1 1 12 1zm0 20c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9-4.03 9-9 9zm-1-14h2v6h-2z"/>
            <path d="M16 9h-1V7c0-2.76-2.24-5-5-5s-5 2.24-5 5v2H7v8h9V9zm-4-2h2v2h-2V7z"/>
          </svg>

          {/* Title */}
          <h1 className="maintenance-lock__title">Estamos en mantenimiento</h1>
          <p className="maintenance-lock__subtitle">Volveremos pronto</p>

          {/* Code Input */}
          <form onSubmit={handleSubmit} className="maintenance-lock__form">
            <input
              type="password"
              className="maintenance-lock__input"
              placeholder="Ingresa el código"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength="6"
            />
            <button type="submit" className="maintenance-lock__btn">
              Acceder
            </button>
            {error && <p className="maintenance-lock__error">{error}</p>}
          </form>

          <p className="maintenance-lock__hint">Solo administradores</p>
        </div>
      </div>
    </div>
  )
}


