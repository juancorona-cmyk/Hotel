import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEventBySlug, createRegistration } from '../lib/turso'
import './EventoPage.css'

export default function EventoPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadEvent = async () => {
      setLoading(true)
      const eventData = await getEventBySlug(slug)
      if (eventData) {
        setEvent(eventData)
      }
      setLoading(false)
    }
    loadEvent()
  }, [slug])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.fullName.trim()) {
      setError('Por favor ingresa tu nombre completo')
      return
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Por favor ingresa un email válido')
      return
    }
    if (!formData.phone.trim()) {
      setError('Por favor ingresa tu teléfono')
      return
    }

    setSubmitting(true)
    try {
      await createRegistration(
        event.id,
        formData.fullName,
        formData.email,
        formData.phone,
        formData.notes
      )
      setSuccess(true)
      setFormData({ fullName: '', email: '', phone: '', notes: '' })
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err) {
      setError('Ocurrió un error al registrarte. Intenta nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="evento-page">
        <div className="evento-container">
          <div className="evento-loading">Cargando evento...</div>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="evento-page">
        <div className="evento-container">
          <div className="evento-error">
            <h2>Evento no disponible</h2>
            <p>El evento que buscas no existe o no está disponible en este momento.</p>
            <button className="evento-back-btn" onClick={() => navigate('/')}>
              ← Volver al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="evento-page">
      <div className="evento-container">
        {/* Event Details */}
        <div className="evento-header">
          <button className="evento-back-btn" onClick={() => navigate('/')}>
            ← Volver al inicio
          </button>
          <h1 className="evento-title">{event.name}</h1>
        </div>

        <div className="evento-details">
          {event.date && (
            <div className="evento-detail-item">
              <span className="evento-detail-label">Fecha:</span>
              <span className="evento-detail-value">{event.date}</span>
            </div>
          )}
          {event.price && (
            <div className="evento-detail-item">
              <span className="evento-detail-label">Precio:</span>
              <span className="evento-detail-value">${event.price.toFixed(2)}</span>
            </div>
          )}
          {event.capacity && (
            <div className="evento-detail-item">
              <span className="evento-detail-label">Capacidad:</span>
              <span className="evento-detail-value">{event.capacity} personas</span>
            </div>
          )}
        </div>

        {event.description && (
          <div className="evento-description">
            <p>{event.description}</p>
          </div>
        )}

        {/* Registration Form */}
        <div className="evento-form-wrapper">
          <h2 className="evento-form-title">Regístrate al evento</h2>

          {success ? (
            <div className="evento-success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p>¡Registrado con éxito!</p>
              <small>Redirecting...</small>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="evento-form">
              <div className="evento-form-group">
                <label htmlFor="fullName" className="evento-label">Nombre completo *</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  className="evento-input"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Tu nombre completo"
                />
              </div>

              <div className="evento-form-group">
                <label htmlFor="email" className="evento-label">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="evento-input"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="tu@email.com"
                />
              </div>

              <div className="evento-form-group">
                <label htmlFor="phone" className="evento-label">Teléfono *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="evento-input"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Tu teléfono"
                />
              </div>

              <div className="evento-form-group">
                <label htmlFor="notes" className="evento-label">Comentarios (opcional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  className="evento-input evento-textarea"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Algún comentario adicional..."
                  rows="4"
                />
              </div>

              {error && <p className="evento-error-msg">{error}</p>}

              <button
                type="submit"
                className="evento-submit-btn"
                disabled={submitting}
              >
                {submitting ? 'Registrando...' : 'Registrarse al evento'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
