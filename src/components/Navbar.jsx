import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './Navbar.css'

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { key: 'nav.inicio',       href: '#inicio' },
    { key: 'nav.nosotros',     href: '#nosotros' },
    { key: 'nav.habitaciones', href: '#habitaciones' },
    { key: 'nav.restaurante',  href: '#restaurante' },
    { key: 'nav.eventos',      href: '#eventos' },
    { key: 'nav.ubicacion',    href: '#ubicacion' },
  ]

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleLang = () =>
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <a href="#inicio" className="navbar__logo-link">
        <img src="/logo/logo.svg" alt="Hotel Punta Galería" className="navbar__logo" />
      </a>
      <button
        className={`navbar__burger ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={t('nav.menu')}
      >
        <span /><span /><span />
      </button>
      <ul className={`navbar__links ${menuOpen ? 'navbar__links--open' : ''}`}>
        {links.map(({ key, href }) => (
          <li key={key}>
            <a href={href} onClick={() => setMenuOpen(false)}>{t(key)}</a>
          </li>
        ))}
        <li className="navbar__lang-item">
          <button className="navbar__lang" onClick={toggleLang} aria-label={t('nav.cambiarIdioma')}>
            <svg className="navbar__lang-globe" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a14.5 14.5 0 0 0 0 20A14.5 14.5 0 0 0 12 2z"/>
              <path d="M2 12h20"/>
            </svg>
            <span className="navbar__lang-code">{i18n.language === 'es' ? 'ES' : 'EN'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="navbar__lang-chevron">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </li>
      </ul>
    </nav>
  )
}
