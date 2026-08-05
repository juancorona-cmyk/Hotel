import { useEffect, useCallback } from 'react'
import './AhmemacModal.css'

export default function AhmemacModal({ onClose }) {
  const handleClose = useCallback((e) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="am-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label="Socio AHMEMAC">
      <div className="am-card">
        <div className="am-header">
          <img src="/Logo-ahmemac.png" alt="AHMEMAC" className="am-header__logo" />
          <div className="am-header__text">
            <span className="am-eyebrow">Respaldo institucional</span>
            <h3>Socio AHMEMAC</h3>
          </div>
          <button className="am-close" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="am-body">
          <p>
            Hotel Punta Galería es socio activo de <strong>AHMEMAC</strong>, la Asociación de Hoteles
            y Moteles del Estado de Michoacán A.C., el organismo que agrupa a los establecimientos
            hoteleros legalmente constituidos en el estado.
          </p>
          <p>
            Contamos además con Registro Nacional de Turismo <strong>RNT 1160530182</strong> ante la
            Secretaría de Turismo, que certifica nuestra operación conforme a la normativa turística vigente.
          </p>
          <ul className="am-points">
            <li>Cumplimos con las políticas de viaje de empresas que exigen hospedarse en hoteles afiliados a asociaciones reconocidas.</li>
            <li>Establecimiento verificado y registrado ante las autoridades de turismo.</li>
            <li>Respaldo y estándares de calidad de la asociación hotelera estatal.</li>
          </ul>
        </div>

        <div className="am-footer">
          <button type="button" className="am-ok-btn" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  )
}
