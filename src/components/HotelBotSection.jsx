import { useState, useRef, useEffect } from 'react'
import OpenAI from 'openai'
import './HotelBotSection.css'

const SYSTEM_PROMPT = `Eres HotelBot, el asistente virtual del Hotel Punta Galería en Morelia, Michoacán. Eres amable, profesional y conciso.

HOTEL:
- Nombre: Hotel Punta Galería
- Dirección: Periférico Paseo de la República 59, Nueva Jacarandas, 58090 Morelia, Mich.
- Historia: ~40 años de experiencia, antes Hostal Real Camelinas, desde 2011 Hotel Punta Galería
- WhatsApp / Recepción: +52 443 123-4567
- Recepción 24 horas

HABITACIONES:
- Deluxe: 1-2 personas | 1 cama King Size | AC, WiFi gratuito, Smart TV, escritorio de trabajo
- Doble: 1-4 personas | 2 camas matrimoniales | AC, WiFi gratuito, Smart TV, escritorio de trabajo
- Check-in: desde las 2:00 pm | Check-out: hasta las 12:00 pm

SERVICIOS:
WiFi gratuito, desayuno incluido, restaurante (desayunos/comidas/cenas), salón de eventos (conferencias, talleres, celebraciones), jardines privados, estacionamiento, recepción 24 hrs

ACTIVIDADES (incluidas, sin costo extra):
- YOGA: viernes a las 7:30 pm
- PILATES: sábados a las 9:00 am

CERCANO AL HOTEL:
Centro Histórico de Morelia, Zoológico Benito Juárez, Plaza Las Américas

INSTRUCCIONES:
- Responde siempre en español, máximo 3 oraciones
- Para reservas de habitación o salón: indica WhatsApp +52 443 123-4567
- Para actividades: menciona el horario y sugiere confirmar por WhatsApp
- Si preguntan por contacto/teléfono: incluye exactamente este texto al final: [CONTACTO: +52 443 123-4567]
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
    <a href={waLink} target="_blank" rel="noopener noreferrer" className="hbs-card hbs-card--contact">
      <span className="hbs-card__icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.562 4.13 1.541 5.858L.057 23.486a.5.5 0 0 0 .614.614l5.628-1.484A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.031-1.362l-.36-.214-3.736.985.985-3.736-.214-.36A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
      </span>
      <div className="hbs-card__body">
        <span className="hbs-card__label">WhatsApp · Recepción 24 hrs</span>
        <span className="hbs-card__value">{phone}</span>
      </div>
      <span className="hbs-card__arrow">›</span>
    </a>
  )
}

function ActivityCard({ name, day, time }) {
  const nameCapital = name.charAt(0).toUpperCase() + name.slice(1)
  const waText = encodeURIComponent(`Hola, me gustaría reservar mi lugar en la clase de ${nameCapital} (${day} ${time}).`)
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`
  return (
    <a href={waLink} target="_blank" rel="noopener noreferrer" className="hbs-card hbs-card--activity">
      <span className="hbs-card__icon hbs-card__icon--activity">
        {name.toLowerCase().includes('yoga') ? '🧘' : '🏋️'}
      </span>
      <div className="hbs-card__body">
        <span className="hbs-card__label">{nameCapital}</span>
        <span className="hbs-card__value">{day} · {time}</span>
      </div>
      <span className="hbs-card__cta">Reservar lugar</span>
    </a>
  )
}

function Message({ msg }) {
  const { text, cards } = parseSpecialCards(msg.content)
  return (
    <div className={`hbs-msg hbs-msg--${msg.role}`}>
      {text && <div className="hbs-bubble">{text}</div>}
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

const FEATURES = [
  { icon: '💬', text: 'Resuelve tus dudas al instante' },
  { icon: '🗓️', text: 'Agenda yoga, pilates y más' },
  { icon: '🏨', text: 'Consulta habitaciones y disponibilidad' },
  { icon: '📞', text: 'Recibe el contacto directo del hotel' },
]

export default function HotelBotSection() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy HotelBot, el asistente virtual del Hotel Punta Galería. ¿En qué puedo ayudarte hoy?'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQuick, setShowQuick] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const client = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return

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
        { role: 'assistant', content: 'Lo siento, hubo un problema. Contáctanos directamente: [CONTACTO: +52 443 123-4567]' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="asistente" className="hbs-section">
      <div className="hbs-inner">

        {/* ── Left panel ── */}
        <div className="hbs-left">
          <p className="hbs-eyebrow">ASISTENTE VIRTUAL</p>
          <h2 className="hbs-title">
            Chatea con<br />
            <span className="hbs-title-accent">HotelBot</span>
          </h2>
          <p className="hbs-desc">
            Nuestro asistente inteligente está disponible las 24 horas para responder todas tus preguntas sobre el hotel.
          </p>

          <ul className="hbs-features">
            {FEATURES.map(f => (
              <li key={f.text} className="hbs-feature">
                <span className="hbs-feature__icon">{f.icon}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>

          <div className="hbs-badge">
            <span className="hbs-badge__dot" />
            En línea ahora · Respuesta inmediata
          </div>
        </div>

        {/* ── Right panel: chat ── */}
        <div className="hbs-chat">
          {/* Header */}
          <div className="hbs-chat__header">
            <div className="hbs-chat__avatar">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
              </svg>
            </div>
            <div>
              <div className="hbs-chat__name">HotelBot</div>
              <div className="hbs-chat__status">
                <span className="hbs-chat__dot" />
                Hotel Punta Galería · En línea
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="hbs-chat__messages">
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && (
              <div className="hbs-msg hbs-msg--assistant">
                <div className="hbs-bubble hbs-bubble--typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick replies */}
          {showQuick && (
            <div className="hbs-chat__quick">
              {QUICK_REPLIES.map(q => (
                <button key={q.label} className="hbs-quick-btn" onClick={() => sendMessage(q.msg)}>
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="hbs-chat__input-area">
            <input
              ref={inputRef}
              className="hbs-chat__input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Escribe tu pregunta…"
              disabled={loading}
            />
            <button
              className="hbs-chat__send"
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

      </div>
    </section>
  )
}
