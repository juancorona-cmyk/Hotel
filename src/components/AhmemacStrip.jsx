import { useTranslation } from 'react-i18next'
import './AhmemacStrip.css'

export default function AhmemacStrip() {
  const { t } = useTranslation()

  return (
    <section id="ahmemac" className="ahmemac-strip">
      <div className="ahmemac-strip__inner">
        <img src="/Logo-ahmemac.png" alt="AHMEMAC" className="ahmemac-strip__logo" />
        <div className="ahmemac-strip__copy">
          <p className="ahmemac-strip__titulo">{t('ahmemac.titulo')}</p>
          <p className="ahmemac-strip__desc">{t('ahmemac.descripcion')}</p>
        </div>
      </div>
    </section>
  )
}
