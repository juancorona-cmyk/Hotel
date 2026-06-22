import './PromoStrip.css'

const items = [
  '20% DESCUENTO',
  'EXCLUSIVO EN LÍNEA',
  'RESERVA DIRECTO',
  'HOTEL PUNTA GALERÍA',
  'OFERTA WEB',
  'SIN INTERMEDIARIOS',
]

const Sep = () => <span className="ps__sep" aria-hidden="true">✦</span>

export default function PromoStrip({ onBook }) {
  return (
    <div className="ps" role="banner" onClick={onBook}>
      <div className="ps__track">
        {[...items, ...items, ...items].map((item, i) => (
          <span key={i} className="ps__item">
            {item}<Sep />
          </span>
        ))}
      </div>
    </div>
  )
}
