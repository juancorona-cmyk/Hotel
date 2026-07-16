import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import './Convenios.css'

const partners = [
  { name: 'Star Médica', img: '/convenios/star-medica.png' },
  { name: 'CFE', img: '/convenios/cfe.png' },
  { name: 'Quality Med', img: '/convenios/quality-med.png' },
  { name: 'Esteripharma', img: '/convenios/esteripharma.png' },
  { name: 'Bna Cosméticos' },
  { name: 'Servcon FYC' },
  { name: 'Sindicato IMSS', img: '/convenios/sindicato-imss.png' },
  { name: 'SUTASPJEM', img: '/convenios/sutaspjem.webp' },
  { name: 'Axalta', img: '/convenios/axalta.jpeg' },
  { name: 'Nadro', img: '/convenios/nadro.png' },
  { name: 'FIRA', img: '/convenios/fira.jpg' },
  { name: 'COPARMEX', img: '/convenios/coparmex.webp' },
  { name: 'Falcom', img: '/convenios/falcom.png' },
  { name: 'Eventos Lienzo Charro', img: '/convenios/eventos-lienzo-charro.jpg' },
  { name: 'Rochem de México', img: '/convenios/rochem-de-mexico.jpeg' },
  { name: 'Tiendas Chedraui', img: '/convenios/tiendas-chedraui.webp' },
  { name: 'Clínica Oftalmológica La Salud', img: '/convenios/clinica-oftalmologica-la-salud.png' },
]

const loop = [...partners, ...partners]

export default function Convenios() {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className={`convenios ${isVisible ? 'is-visible' : ''}`} ref={sectionRef}>
      <div className="convenios__head">
        <p className="convenios__eyebrow">{t('convenios.eyebrow')}</p>
        <h2 className="convenios__title">{t('convenios.titulo')}</h2>
      </div>
      <div className="convenios__track-wrap">
        <div className="convenios__track">
          {loop.map((p, i) => (
            <div key={i} className="convenio-card" aria-hidden={i >= partners.length ? 'true' : 'false'}>
              {p.img
                ? <img src={p.img} alt={i < partners.length ? p.name : ''} loading="lazy" className="convenio-card__img" />
                : <span className="convenio-card__name">{p.name}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
