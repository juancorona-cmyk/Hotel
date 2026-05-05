import { useTranslation } from 'react-i18next'
import { trackEvent } from '../lib/turso'
import './Footer.css'

const NAV = [
  { label: 'Inicio',          href: '#inicio' },
  { label: 'Nosotros',        href: '#nosotros' },
  { label: 'Habitaciones',    href: '#habitaciones' },
  { label: 'Restaurante',     href: '#restaurante' },
  { label: 'Salón de eventos',href: '#eventos' },
  { label: 'Ubicación',       href: '#ubicacion' },
]

const SOCIAL = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/1FdLSaA8ww/',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/hotelpuntagaleriamx?igsh=MWdwNGJxbnM1aGV4OA==',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
        <rect x="2" y="2" width="20" height="20" rx="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@hotelpuntagaleria_mx?_r=1&_t=ZS-967DCBIVs84',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.6-4.12-1.31a6.33 6.33 0 0 1-1.87-1.52v7.33c0 2.24-.74 4.54-2.4 6.04-1.63 1.54-4.04 2.22-6.24 1.93-2.1-.23-4.15-1.53-5.21-3.38A8.83 8.83 0 0 1 1.7 15.02c.16-2.13 1.1-4.24 2.76-5.63 1.63-1.4 3.96-1.99 6.08-1.56v4.13c-1.3-.35-2.83-.06-3.87.82-1.01.83-1.47 2.22-1.25 3.48.24 1.18 1.18 2.19 2.36 2.47 1.25.33 2.67-.1 3.47-1.08.6-.74.9-1.69.89-2.65V.02z"/>
      </svg>
    ),
  },
  {
    label: 'WhatsApp',
    href: 'https://wa.me/5214431234567',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.562 4.13 1.541 5.858L.057 23.486a.5.5 0 0 0 .614.614l5.628-1.484A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.031-1.362l-.36-.214-3.736.985.985-3.736-.214-.36A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
      </svg>
    ),
  },
]

export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  const NAV = [
    { label: t('nav.inicio'),       href: '#inicio' },
    { label: t('nav.nosotros'),     href: '#nosotros' },
    { label: t('nav.habitaciones'), href: '#habitaciones' },
    { label: t('nav.restaurante'),  href: '#restaurante' },
    { label: t('nav.eventos'),      href: '#eventos' },
    { label: t('nav.ubicacion'),    href: '#ubicacion' },
  ]

  return (
    <footer className="footer">
      <div className="footer__top">

        {/* Brand */}
        <div className="footer__brand">
          <img src="/logo/logo.svg" alt="Hotel Punta Galería" className="footer__logo" />
          <p className="footer__tagline">{t('nosotros.lead')}</p>
          <div className="footer__social">
            {SOCIAL.map(({ label, href, icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="footer__social-btn" aria-label={label}
                onClick={label === 'WhatsApp' ? () => trackEvent('whatsapp_click', { source: 'footer_social' }) : undefined}>
                {icon}
              </a>
            ))}
          </div>
        </div>

        {/* Nav */}
        <div className="footer__col">
          <p className="footer__col-title">{t('footer.navegacion')}</p>
          <ul className="footer__links">
            {NAV.map(({ label, href }) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="footer__col">
          <p className="footer__col-title">{t('footer.contacto')}</p>
          <ul className="footer__contact">
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>{t('footer.direccion')}</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/>
              </svg>
              <span>+52 (443) 123-4567</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
              <span>{t('footer.recepcion')}</span>
            </li>
          </ul>
          <a
            href="https://wa.me/5214431234567?text=Hola,%20quisiera%20hacer%20una%20reservación"
            target="_blank" rel="noopener noreferrer"
            className="footer__cta"
            onClick={() => trackEvent('whatsapp_click', { source: 'footer_reservar' })}
          >
            {t('footer.reservar')}
          </a>
        </div>

      </div>

      {/* Bottom bar */}
      <div className="footer__bottom">
        <span>© {year} {t('footer.derechos')}</span>
        <div className="footer__bottom-links">
          <a href="#inicio">{t('footer.privacidad')}</a>
          <span>·</span>
          <a href="#inicio">{t('footer.terminos')}</a>
        </div>
      </div>
    </footer>
  )
}
