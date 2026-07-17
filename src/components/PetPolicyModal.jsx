import { useEffect, useState, useCallback } from 'react'
import { PET_POLICY_RULES, openPetPolicyPdf } from '../lib/petPolicyPdf'
import './PetPolicyModal.css'

export default function PetPolicyModal({ onClose }) {
  const [pdfBusy, setPdfBusy] = useState(false)

  const handleClose = useCallback((e) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handlePdfClick = async () => {
    if (pdfBusy) return
    setPdfBusy(true)
    try {
      await openPetPolicyPdf()
    } catch (err) {
      console.error('[petPolicy] Error:', err)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="ppm-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label="Reglamento de mascotas">
      <div className="ppm-card">
        <div className="ppm-header">
          <div className="ppm-header__icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <circle cx="4.5" cy="9.5" r="2.2"/><circle cx="9" cy="5.5" r="2.2"/><circle cx="15" cy="5.5" r="2.2"/><circle cx="19.5" cy="9.5" r="2.2"/>
              <path d="M12 11c-3.3 0-7 2.3-7 5.6 0 1.9 1.5 3.4 3.4 3.4.9 0 1.5-.3 2.4-.6.7-.3 1.4-.5 2.2-.5s1.5.2 2.2.5c.9.3 1.5.6 2.4.6 1.9 0 3.4-1.5 3.4-3.4 0-3.3-3.7-5.6-7-5.6z"/>
            </svg>
          </div>
          <div className="ppm-header__text">
            <span className="ppm-eyebrow">Habitaciones Pet Friendly</span>
            <h3>Reglamento de Mascotas</h3>
          </div>
          <button className="ppm-close" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="ppm-body">
          <p className="ppm-intro">
            Nos llena de alegría recibirlos a ustedes y a sus queridas mascotas, parte de su familia.
            Solo 2 habitaciones cuentan con este servicio — reserve con anticipación.
          </p>
          <ol className="ppm-rules">
            {PET_POLICY_RULES.map((rule, i) => <li key={i}>{rule}</li>)}
          </ol>
        </div>

        <div className="ppm-footer">
          <button type="button" className="ppm-pdf-btn" onClick={handlePdfClick} disabled={pdfBusy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            {pdfBusy ? 'Generando…' : 'Ver PDF completo'}
          </button>
          <button type="button" className="ppm-ok-btn" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  )
}
