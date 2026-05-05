import { useState, useRef, useEffect } from 'react'
import OpenAI from 'openai'
import { trackEvent } from '../../lib/turso'
import './HotelBot.css'

const SYSTEM_PROMPT = `Eres HotelBot, el asistente virtual del Hotel Punta Galería en Morelia, Michoacán. Eres amable, profesional y conciso.

HOTEL:
- Nombre: Hotel Punta Galería
- Dirección: Periférico Paseo de la República 59, Nueva Jacarandas, 58090 Morelia, Mich.
- Historia: ~40 años de experiencia, antes Hostal Real Camelinas, desde 2011 Hotel Punta Galería
- WhatsApp / Recepción: +52 443 123-4567
- Recepción 24 horas

HABITACIONES (ambas incluyen: AC, WiFi gratuito, Smart TV, escritorio de trabajo):
- Deluxe: hasta 2 personas | 1 cama King Size
- Doble:  hasta 4 personas | 2 camas matrimoniales
- Check-in: 24 horas (a cualquier hora)
- Check-out: 24 horas (a cualquier hora)
- Recepción: 24 horas

SERVICIOS:
WiFi gratuito, desayuno incluido, restaurante (desayunos/comidas/cenas), salón de eventos (conferencias, talleres, celebraciones), jardines privados, estacionamiento, recepción 24 hrs

ACTIVIDADES (incluidas, sin costo extra):
- YOGA: viernes a las 7:30 pm
- PILATES: sábados a las 9:00 am

CERCANO AL HOTEL:
Centro Histórico de Morelia, Zoológico Benito Juárez, Plaza Las Américas

INSTRUCCIONES:
- Responde siempre en español, máximo 4 oraciones
- Al hablar de habitaciones: menciona primero las amenidades compartidas (AC, WiFi, Smart TV, escritorio) UNA SOLA VEZ, luego diferencia cada tipo solo por capacidad y tipo de cama. No repitas las mismas amenidades para cada habitación.
- Al hablar de check-in/out: indica que tanto el check-in como el check-out son las 24 horas, a cualquier hora del día o de la noche.
- Para reservas de habitación o salón: indica WhatsApp +52 443 123-4567
- Para actividades: menciona el horario y sugiere confirmar por WhatsApp
- Si preguntan por contacto/teléfono: NO escribas el número en el texto. Solo responde algo como "Puedes contactarnos directamente por WhatsApp:" e incluye al final: [CONTACTO: +52 443 123-4567]
- Si preguntan por yoga o pilates: incluye exactamente este texto: [ACTIVIDAD: yoga|viernes|7:30 pm] o [ACTIVIDAD: pilates|sábados|9:00 am]
- No inventes información fuera de lo proporcionado`

const WHATSAPP_NUMBER = '5214431234567'

function parseSpecialCards(content) {
  const cards = []
  let text = content

  const contactMatch = text.match(/\[CONTACTO: ([^\]]+)\]/)
  if (contactMatch) {
    cards.push({ type: 'contact', phone: contactMatch[1].trim() })
    text = text.replace(contactMatch[0], '').trim()
  }

  const activityRegex = /\[ACTIVIDAD: ([^|]+)\|([^|]+)\|([^\]]+)\]/g
  let m
  while ((m = activityRegex.exec(content)) !== null) {
    cards.push({ type: 'activity', name: m[1].trim(), day: m[2].trim(), time: m[3].trim() })
    text = text.replace(m[0], '').trim()
  }

  return { text, cards }
}

function ContactCard({ phone }) {
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=Hola%2C%20me%20gustar%C3%ADa%20obtener%20informaci%C3%B3n`
  return (
    <a href={waLink} target="_blank" rel="noopener noreferrer" className="hb-card hb-card--contact"
      onClick={() => trackEvent('whatsapp_click', { source: 'bot_contact' })}>
      <span className="hb-card__icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.562 4.13 1.541 5.858L.057 23.486a.5.5 0 0 0 .614.614l5.628-1.484A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.031-1.362l-.36-.214-3.736.985.985-3.736-.214-.36A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
      </span>
      <div className="hb-card__body">
        <span className="hb-card__label">WhatsApp · Recepción 24 hrs</span>
        <span className="hb-card__value">{phone}</span>
      </div>
      <span className="hb-card__arrow">›</span>
    </a>
  )
}

function ActivityCard({ name, day, time }) {
  const nameCapital = name.charAt(0).toUpperCase() + name.slice(1)
  const waText = encodeURIComponent(`Hola, me gustaría reservar mi lugar en la clase de ${nameCapital} (${day} ${time}).`)
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`
  return (
    <a href={waLink} target="_blank" rel="noopener noreferrer" className="hb-card hb-card--activity"
      onClick={() => trackEvent('whatsapp_click', { source: 'bot_activity', activity: name })}>
      <span className="hb-card__icon hb-card__icon--activity">
        {name.toLowerCase().includes('yoga') ? '🧘' : '🏋️'}
      </span>
      <div className="hb-card__body">
        <span className="hb-card__label">{nameCapital}</span>
        <span className="hb-card__value">{day} · {time}</span>
      </div>
      <span className="hb-card__cta">Reservar lugar</span>
    </a>
  )
}

function Message({ msg }) {
  const { text, cards } = parseSpecialCards(msg.content)
  return (
    <div className={`hb-msg hb-msg--${msg.role}`}>
      {text && <div className="hb-bubble">{text}</div>}
      {cards.map((card, i) =>
        card.type === 'contact'
          ? <ContactCard key={i} phone={card.phone} />
          : <ActivityCard key={i} name={card.name} day={card.day} time={card.time} />
      )}
    </div>
  )
}

const QUICK_REPLIES = [
  { label: 'Reservar habitación', msg: 'Quiero reservar una habitación, ¿qué opciones tienen?' },
  { label: 'Ver actividades', msg: '¿Qué actividades tienen disponibles y cuáles son los horarios?' },
  { label: 'Check-in / Check-out', msg: '¿Cuáles son los horarios de check-in y check-out?' },
  { label: 'Número de contacto', msg: '¿Cuál es el número de contacto o WhatsApp del hotel?' },
]

export default function HotelBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy HotelBot, el asistente virtual del Hotel Punta Galería. ¿En qué puedo ayudarte hoy?'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQuick, setShowQuick] = useState(true)
  const [showGreeting, setShowGreeting] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const client = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  })

  // Tarjeta de saludo: aparece a los 2.5 s, se cierra sola a los 6 s
  // Solo una vez por sesión (sessionStorage se limpia al recargar)
  useEffect(() => {
    if (sessionStorage.getItem('hb_greeted')) return
    const show = setTimeout(() => setShowGreeting(true), 2500)
    const hide = setTimeout(() => {
      setShowGreeting(false)
      sessionStorage.setItem('hb_greeted', '1')
    }, 8500)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [])

  useEffect(() => {
    if (open) setShowGreeting(false)
  }, [open])

  // Tecla F → abrir/cerrar (sin estar en un input) | ESC → cerrar
  useEffect(() => {
    const handleKey = (e) => {
      const tag = e.target.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key.toLowerCase() === 'f' && !typing) setOpen(o => { if (!o) trackEvent('bot_open'); return !o })
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return

    trackEvent('bot_message', { len: userText.length })
    setInput('')
    setShowQuick(false)
    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...newMessages.map(m => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 350,
        temperature: 0.65,
      })

      const reply = response.choices[0].message.content
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Lo siento, hubo un problema de conexión. Por favor contáctanos directamente: [CONTACTO: +52 443 123-4567]' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <div className="hb-window">
          <div className="hb-header">
            <div className="hb-header-info">
              <div className="hb-avatar">
                <img src="/icono.svg" alt="HotelBot" width="32" height="32" style={{ objectFit: 'contain' }} />
              </div>
              <div>
                <div className="hb-name">HotelBot</div>
                <div className="hb-status">
                  <span className="hb-status-dot" />
                  Hotel Punta Galería · En línea
                </div>
              </div>
            </div>
            <button className="hb-close" onClick={() => setOpen(false)} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <div className="hb-messages">
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && (
              <div className="hb-msg hb-msg--assistant">
                <div className="hb-bubble hb-bubble--typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showQuick && (
            <div className="hb-quick-replies">
              {QUICK_REPLIES.map(q => (
                <button key={q.label} className="hb-quick-btn" onClick={() => sendMessage(q.msg)}>
                  {q.label}
                </button>
              ))}
            </div>
          )}

          <div className="hb-input-area">
            <input
              ref={inputRef}
              className="hb-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Escribe tu pregunta…"
              disabled={loading}
            />
            <button
              className="hb-send"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              aria-label="Enviar"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {showGreeting && !open && (
        <div className="hb-greeting">
          <button className="hb-greeting__close" onClick={() => { setShowGreeting(false); sessionStorage.setItem('hb_greeted', '1') }} aria-label="Cerrar">✕</button>
          <div className="hb-greeting__avatar">
            <img src="/icono.svg" alt="HotelBot" width="28" height="28" style={{ objectFit: 'contain' }} />
          </div>
          <div className="hb-greeting__body">
            <p className="hb-greeting__title">¡Hola! 👋 Soy HotelBot</p>
            <p className="hb-greeting__text">Tu asistente virtual del Hotel Punta Galería. ¿En qué puedo ayudarte?</p>
            <button className="hb-greeting__cta" onClick={() => { trackEvent('bot_open'); setOpen(true) }}>
              Iniciar chat
            </button>
          </div>
          <div className="hb-greeting__arrow" />
        </div>
      )}

      <button
        className={`hb-fab ${open ? 'hb-fab--open' : ''}`}
        onClick={() => { setOpen(o => { if (!o) trackEvent('bot_open'); return !o }) }}
        aria-label="Abrir asistente HotelBot (tecla F)"
        title="HotelBot · tecla F"
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        ) : (
          <img src="/icono.svg" alt="HotelBot" width="36" height="36" style={{ objectFit: 'contain' }} />
        )}
        {!open && <span className="hb-fab-badge" />}
      </button>
    </>
  )
}
