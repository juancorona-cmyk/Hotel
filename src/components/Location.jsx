import { useTranslation } from 'react-i18next'
import { trackEvent } from '../lib/turso'
import './Location.css'

// Coordenadas exactas del pin verificado en Google Maps
const MAP_SRC =
  'https://maps.google.com/maps?q=19.6810893,-101.1915037&z=17&output=embed&hl=es&iwloc=near'

export default function Location() {
  const { t } = useTranslation()

  return (
    <section id="ubicacion" className="location">
      <div className="location__inner">

        {/* ── Info panel ─────────────────────────── */}
        <div className="location__panel">
          <span className="location__eyebrow">{t('ubicacion.eyebrow')}</span>
          <h2 className="location__title">{t('ubicacion.titulo')}</h2>

          <ul className="location__details">
            <li>
              <div className="location__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                  <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>
                <span className="location__detail-lbl">{t('ubicacion.direccionLbl')}</span>
                <span className="location__detail-val">{t('ubicacion.direccion')}</span>
              </div>
            </li>
            <li>
              <div className="location__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div>
                <span className="location__detail-lbl">{t('ubicacion.horariosLbl')}</span>
                <span className="location__detail-val">{t('ubicacion.checkinVal')}</span>
                <span className="location__detail-val">{t('ubicacion.checkoutVal')}</span>
              </div>
            </li>
            <li>
              <div className="location__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/>
                </svg>
              </div>
              <div>
                <span className="location__detail-lbl">{t('ubicacion.recepcionLbl')}</span>
                <span className="location__detail-val">+52 (443) 397-27-20</span>
              </div>
            </li>
            <li>
              <div className="location__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/>
                </svg>
              </div>
              <div>
                <span className="location__detail-lbl">Atención a clientes</span>
                <span className="location__detail-val">+52 1 443 123 4567</span>
              </div>
            </li>
            <li>
              <div className="location__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </div>
              <div>
                <span className="location__detail-lbl">{t('ubicacion.cercaLbl')}</span>
                <span className="location__detail-val">{t('ubicacion.puntosCerca')}</span>
              </div>
            </li>
          </ul>

          <a
            href="https://wa.me/5214433972720?text=Hola,%20me%20gustaría%20obtener%20más%20información"
            target="_blank" rel="noopener noreferrer"
            className="location__btn"
            onClick={() => trackEvent('whatsapp_click', { source: 'ubicacion' })}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.562 4.13 1.541 5.858L.057 23.486a.5.5 0 0 0 .614.614l5.628-1.484A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.031-1.362l-.36-.214-3.736.985.985-3.736-.214-.36A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            {t('ubicacion.btn')}
          </a>

          <a
            href="https://maps.app.goo.gl/zVfijHYbgkQ5U4Sr9"
            target="_blank" rel="noopener noreferrer"
            className="location__directions"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            {t('ubicacion.googleMapsBtn')}
          </a>
        </div>

        {/* ── Map ────────────────────────────────── */}
        <div className="location__map-wrap">
          <iframe
            title={t('ubicacion.titulo')}
            src={MAP_SRC}
            width="100%" height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />

          {/* Card flotante sobre el pin */}
          <div className="location__float-card">
            <div className="location__float-pin">
              <svg viewBox="0 0 24 24" fill="#e74c3c" width="22" height="22">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <div className="location__float-body">
              <p className="location__float-name">Hotel Punta Galería</p>
              <p className="location__float-addr">Perif. Paseo de la República 59,<br/>Nueva Jacarandas, Morelia, Mich.</p>
              <div className="location__float-tags">
                <span>⭐ 4.3</span>
                <span>Hotel</span>
              </div>
              <a
                href="https://maps.app.goo.gl/zVfijHYbgkQ5U4Sr9"
                target="_blank" rel="noopener noreferrer"
                className="location__float-link"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="12" height="12">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                {t('ubicacion.comoLlegar')}
              </a>
            </div>
            <div className="location__float-tail" />
          </div>
        </div>

      </div>
    </section>
  )
}
