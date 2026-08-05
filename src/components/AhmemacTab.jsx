import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AhmemacModal from './AhmemacModal'
import './AhmemacTab.css'

export default function AhmemacTab() {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button
        type="button"
        className="ahmemac-tab"
        aria-label={t('ahmemac.mensaje')}
        onClick={() => setShowModal(true)}
      >
        <img src="/Logo-ahmemac.png" alt="" className="ahmemac-tab__img" />
        <span className="ahmemac-tab__text">{t('ahmemac.tab')}</span>
      </button>
      {showModal && <AhmemacModal onClose={() => setShowModal(false)} />}
    </>
  )
}
