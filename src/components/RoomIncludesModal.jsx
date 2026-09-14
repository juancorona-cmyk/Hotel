import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import './RoomIncludesModal.css'

const icons = {
  clock:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M12 7v5l3 3"/></svg>,
  desayuno: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  precio:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
}

export default function RoomIncludesModal({ room, onClose }) {
  const { t } = useTranslation()

  const handleClose = useCallback((e) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="rim-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label={t('habitaciones.detallesReserva')}>
      <div className="rim-card">
        <div className="rim-header">
          <div className="rim-header__icon">{icons.clock}</div>
          <div className="rim-header__text">
            <span className="rim-eyebrow">{room.name}</span>
            <h3>{t('habitaciones.detallesReserva')}</h3>
          </div>
          <button className="rim-close" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="rim-body">
          <ul className="rim-list">
            <li>
              <div className="rim-list__icon">{icons.clock}</div>
              <span>{t('habitaciones.checkinCheckout')}</span>
            </li>
            <li className="rim-list--highlight">
              <div className="rim-list__icon">{icons.desayuno}</div>
              <span>{t('amenidades.desayuno')}</span>
            </li>
            <li>
              <div className="rim-list__icon">{icons.precio}</div>
              <span>{t('habitaciones.precioWeb')}</span>
            </li>
          </ul>
        </div>

        <div className="rim-footer">
          <button type="button" className="rim-ok-btn" onClick={onClose}>{t('habitaciones.entendido')}</button>
        </div>
      </div>
    </div>
  )
}
