import { useState } from 'react'
import { createActivityRegistration } from '../lib/turso'
import './ActivityRegModal.css'

export default function ActivityRegModal({ activity, onClose }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone]       = useState('')
  const [howFound, setHowFound] = useState('')
  const [howFoundOther, setHowFoundOther] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Por favor ingresa tu nombre completo'); return }
    if (!phone.trim())    { setError('Por favor ingresa tu número de teléfono'); return }
    if (!howFound)        { setError('Por favor indica cómo te enteraste'); return }
    if (!whatsapp)        { setError('Por favor responde la pregunta de WhatsApp'); return }

    const howFoundFinal = howFound === 'Otros' ? `Otros: ${howFoundOther}` : howFound

    setSaving(true)
    try {
      await createActivityRegistration(
        activity.id,
        activity.name,
        fullName.trim(),
        phone.trim(),
        howFoundFinal,
        whatsapp,
      )
      setSuccess(true)
      setTimeout(onClose, 2000)
    } catch {
      setError('Error al registrar. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="arm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="arm-card">
        <div className="arm-header">
          <div>
            <span className="arm-eyebrow">Inscripción</span>
            <h2 className="arm-title">{activity.name}</h2>
          </div>
          <button className="arm-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {success ? (
          <div className="arm-success">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p>¡Registro exitoso!</p>
            <small>Nos vemos pronto 🌿</small>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="arm-form">

            {/* Nombre */}
            <div className="arm-field">
              <label className="arm-label">Nombre completo <span>(Persona que tomará la clase)</span> *</label>
              <input
                type="text"
                className="arm-input"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setError('') }}
                placeholder="Tu nombre completo"
              />
            </div>

            {/* Teléfono */}
            <div className="arm-field">
              <label className="arm-label">Número de teléfono *</label>
              <input
                type="tel"
                className="arm-input"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError('') }}
                placeholder="Ej: 667 123 4567"
              />
            </div>

            {/* Cómo te enteraste */}
            <div className="arm-field">
              <label className="arm-label">¿Cómo te enteraste del evento? *</label>
              <div className="arm-radio-group">
                {['Instagram', 'Facebook', 'Conocido', 'Otros'].map(opt => (
                  <label key={opt} className={`arm-radio-label ${howFound === opt ? 'arm-radio-label--active' : ''}`}>
                    <input
                      type="radio"
                      name="howFound"
                      value={opt}
                      checked={howFound === opt}
                      onChange={() => { setHowFound(opt); setError('') }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
              {howFound === 'Otros' && (
                <input
                  type="text"
                  className="arm-input arm-input--sm"
                  value={howFoundOther}
                  onChange={e => setHowFoundOther(e.target.value)}
                  placeholder="¿Cuál?"
                />
              )}
            </div>

            {/* WhatsApp */}
            <div className="arm-field">
              <label className="arm-label">¿Te gustaría que te agreguemos al grupo de WhatsApp para futuros eventos? *</label>
              <div className="arm-radio-group">
                {['Sí', 'No', 'Ya estoy dentro'].map(opt => (
                  <label key={opt} className={`arm-radio-label ${whatsapp === opt ? 'arm-radio-label--active' : ''}`}>
                    <input
                      type="radio"
                      name="whatsapp"
                      value={opt}
                      checked={whatsapp === opt}
                      onChange={() => { setWhatsapp(opt); setError('') }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="arm-error">{error}</p>}

            <button type="submit" className="arm-submit" disabled={saving}>
              {saving ? 'Registrando…' : 'Confirmar inscripción'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
