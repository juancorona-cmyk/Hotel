import './PromoStrip.css'

const Sep = () => <span className="ps__sep" aria-hidden="true">✦</span>

export default function PromoStrip({ onBook, promoConfig = { label: '20% DESCUENTO', color: '#b5c840' } }) {
  const items = [
    promoConfig.label,
    'EXCLUSIVO EN LÍNEA',
    'RESERVA DIRECTO',
    'HOTEL PUNTA GALERÍA',
    'OFERTA WEB',
    'SIN INTERMEDIARIOS',
  ]

  return (
    <div className="ps" role="banner" onClick={onBook} style={{ background: promoConfig.color }}>
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
