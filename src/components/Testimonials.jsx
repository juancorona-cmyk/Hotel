import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Testimonials.css'

const Stars = ({ n }) => (
  <div className="review__stars">
    {Array.from({ length: n }).map((_, i) => (
      <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#b5c840">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ))}
  </div>
)

export default function Testimonials() {
  const { t } = useTranslation()
  const [current, setCurrent] = useState(0)

  const reviews = [
    { id: 1, nameKey: 'testimonios.r1nombre', originKey: 'testimonios.r1origen', textKey: 'testimonios.r1texto', initials: 'MG', rating: 5 },
    { id: 2, nameKey: 'testimonios.r2nombre', originKey: 'testimonios.r2origen', textKey: 'testimonios.r2texto', initials: 'CR', rating: 5 },
    { id: 3, nameKey: 'testimonios.r3nombre', originKey: 'testimonios.r3origen', textKey: 'testimonios.r3texto', initials: 'LM', rating: 5 },
    { id: 4, nameKey: 'testimonios.r4nombre', originKey: 'testimonios.r4origen', textKey: 'testimonios.r4texto', initials: 'RS', rating: 5 },
  ]

  const prev = () => setCurrent((c) => (c - 1 + reviews.length) % reviews.length)
  const next = () => setCurrent((c) => (c + 1) % reviews.length)

  return (
    <section id="testimonios" className="testimonials">
      <div className="testimonials__inner">
        <p className="testimonials__eyebrow">{t('testimonios.eyebrow')}</p>
        <h2 className="testimonials__title">{t('testimonios.titulo')}</h2>

        <div className="testimonials__slider">
          <button className="testimonials__arrow" onClick={prev} aria-label="Anterior">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="testimonials__cards">
            {[0, 1, 2].map((offset) => {
              const r = reviews[(current + offset) % reviews.length]
              return (
                <div key={r.id} className={`review ${offset === 1 ? 'review--center' : 'review--side'}`}>
                  <Stars n={r.rating} />
                  <p className="review__text">"{t(r.textKey)}"</p>
                  <div className="review__author">
                    <div className="review__avatar">{r.initials}</div>
                    <div>
                      <strong>{t(r.nameKey)}</strong>
                      <span>{t(r.originKey)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button className="testimonials__arrow" onClick={next} aria-label="Siguiente">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="testimonials__dots">
          {reviews.map((_, i) => (
            <button key={i}
              className={`testimonials__dot ${i === current ? 'testimonials__dot--active' : ''}`}
              onClick={() => setCurrent(i)} />
          ))}
        </div>
      </div>
    </section>
  )
}
