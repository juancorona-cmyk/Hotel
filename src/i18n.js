import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './locales/es.json'
import en from './locales/en.json'

// 1. Si el usuario cambió idioma manualmente, respetar esa elección
// 2. Si no, detectar el idioma del navegador/sistema operativo
function detectLanguage() {
  const saved = localStorage.getItem('hotel_lang')
  if (saved === 'es' || saved === 'en') return saved

  const browserLang = navigator.language || navigator.languages?.[0] || 'es'
  return browserLang.toLowerCase().startsWith('en') ? 'en' : 'es'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: detectLanguage(),
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
  })

// Guardar preferencia cada vez que el usuario cambie idioma manualmente
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('hotel_lang', lng)
})

export default i18n
