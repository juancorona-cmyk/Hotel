import './Marquee.css'

const items = [
  'Descanso',
  'Naturaleza',
  'Gastronomía',
  'Eventos',
  'Bienestar',
  'Jardines',
  'Hospitalidad',
  'Tradición',
  'Relax',
  'Confort',
]

const Sep = () => (
  <span className="marquee__sep" aria-hidden="true">✦</span>
)

export default function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="marquee__item">
            {item}<Sep />
          </span>
        ))}
      </div>
    </div>
  )
}
