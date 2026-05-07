import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getRegistrationById, checkInRegistration, undoCheckInRegistration } from '../lib/turso'
import './CheckInPage.css'

export default function CheckInPage() {
  const [searchParams] = useSearchParams()
  const rid = searchParams.get('rid')

  const [reg, setReg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!rid) { setLoading(false); return }
    getRegistrationById(parseInt(rid))
      .then(r => setReg(r))
      .catch(() => setReg(null))
      .finally(() => setLoading(false))
  }, [rid])

  const handleCheckIn = async () => {
    setUpdating(true)
    try {
      await checkInRegistration(reg.id)
      setReg(r => ({ ...r, checked_in: 1, checked_in_at: new Date().toISOString() }))
      setStatus('confirmed')
      setTimeout(() => setStatus(''), 3000)
    } catch {
      setStatus('error')
    } finally {
      setUpdating(false)
    }
  }

  const handleUndo = async () => {
    setUpdating(true)
    try {
      await undoCheckInRegistration(reg.id)
      setReg(r => ({ ...r, checked_in: 0, checked_in_at: null }))
      setStatus('undone')
      setTimeout(() => setStatus(''), 3000)
    } catch {
      setStatus('error')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="ci-page">
        <div className="ci-card">
          <p className="ci-loading">Verificando entrada...</p>
        </div>
      </div>
    )
  }

  if (!reg) {
    return (
      <div className="ci-page">
        <div className="ci-card ci-card--error">
          <div className="ci-icon ci-icon--x">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2 className="ci-title">Entrada no encontrada</h2>
          <p className="ci-sub">El ticket escaneado no existe o el ID es inválido.</p>
        </div>
      </div>
    )
  }

  const isCheckedIn = reg.checked_in === 1 || reg.checked_in === '1'

  return (
    <div className="ci-page">
      <div className={`ci-card ${isCheckedIn ? 'ci-card--done' : ''}`}>
        <div className="ci-header">
          <img src="/logo/logNegro.svg" alt="Hotel Punta Galería" className="ci-logo" />
        </div>

        <div className="ci-body">
          {isCheckedIn ? (
            <div className="ci-badge ci-badge--ok">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>YA CONFIRMADO</span>
            </div>
          ) : (
            <div className="ci-badge ci-badge--pending">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              </svg>
              <span>PENDIENTE DE ENTRADA</span>
            </div>
          )}

          <div className="ci-info">
            <div className="ci-info__row ci-info__row--name">
              <span className="ci-info__label">Persona</span>
              <span className="ci-info__value ci-info__value--big">{reg.full_name}</span>
            </div>
            <div className="ci-info__row">
              <span className="ci-info__label">Actividad</span>
              <span className="ci-info__value">{reg.activity_name || '—'}</span>
            </div>
            {reg.event_name && (
              <div className="ci-info__row">
                <span className="ci-info__label">Evento</span>
                <span className="ci-info__value">{reg.event_name}</span>
              </div>
            )}
            <div className="ci-info__row">
              <span className="ci-info__label">Ticket</span>
              <span className="ci-info__value ci-info__value--id">#{String(reg.id).padStart(4, '0')}</span>
            </div>
            <div className="ci-info__row">
              <span className="ci-info__label">Teléfono</span>
              <span className="ci-info__value">{reg.phone}</span>
            </div>
            <div className="ci-info__row">
              <span className="ci-info__label">Registrado</span>
              <span className="ci-info__value">{String(reg.created_at || '').slice(0, 16).replace('T', ' ')}</span>
            </div>
            {isCheckedIn && reg.checked_in_at && (
              <div className="ci-info__row ci-info__row--check">
                <span className="ci-info__label">Entrada confirmada</span>
                <span className="ci-info__value">{String(reg.checked_in_at).slice(0, 16).replace('T', ' ')}</span>
              </div>
            )}
          </div>

          {status === 'confirmed' && <p className="ci-status ci-status--ok">Entrada confirmada exitosamente</p>}
          {status === 'undone' && <p className="ci-status ci-status--warn">Confirmación deshecha</p>}
          {status === 'error' && <p className="ci-status ci-status--err">Error. Intenta de nuevo.</p>}

          <div className="ci-actions">
            {isCheckedIn ? (
              <button className="ci-btn ci-btn--undo" onClick={handleUndo} disabled={updating}>
                {updating ? 'Procesando...' : 'Deshacer confirmación'}
              </button>
            ) : (
              <button className="ci-btn ci-btn--confirm" onClick={handleCheckIn} disabled={updating}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {updating ? 'Confirmando...' : 'Confirmar entrada'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
