import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { getActivities, getEventByActivityId, trackEvent } from '../lib/turso'
import { getActivityIcon } from '../lib/activityIcons'
import { fmtFecha, fmtHora } from '../lib/utils'
import ActivityRegModal from './ActivityRegModal'
import './Amenidades.css'

const STATIC_ACTIVITIES = [
  { id: 's1', name: 'Yoga',    fecha: 'Viernes',  hora: '7:30 pm', semanas: 'todas' },
  { id: 's2', name: 'Pilates', fecha: 'Sábados',  hora: '9:00 am', semanas: 'todas' },
]

// Week 1 = days 1-7, week 2 = 8-14, week 3 = 15-21, week 4 = 22-28, week 5 = 29+
function getWeekOfMonth() {
  return Math.ceil(new Date().getDate() / 7)
}

function isActivityVisible(a) {
  const s = a.semanas ?? 'todas'
  if (s === 'todas') return true
  const w = getWeekOfMonth()
  if (s === 'sem13') return w % 2 === 1   // odd weeks: 1, 3, 5
  if (s === 'sem24') return w % 2 === 0   // even weeks: 2, 4
  return true
}

const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
  </svg>
)

export default function Amenidades() {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const [dbActivities, setDbActivities] = useState(null)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [linkedEvent, setLinkedEvent] = useState(null)
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    getActivities()
      .then(data => setDbActivities(data))
      .catch(() => setDbActivities([]))
  }, [])

  const amenidades = [
    { key: 'amenidades.wifi',        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg> },
    { key: 'amenidades.desayuno',    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> },
    { key: 'amenidades.restaurante', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg> },
    { key: 'amenidades.salon',       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { key: 'amenidades.jardines',    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { key: 'amenidades.checkin',     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> },
  ]

  const activities = (dbActivities?.length ? dbActivities : STATIC_ACTIVITIES)
    .filter(isActivityVisible)

  return (
    <section id="amenidades" className={`amenidades ${isVisible ? 'is-visible' : ''}`} ref={sectionRef}>
      <div className="amenidades__inner">
        <p className="amenidades__eyebrow">{t('amenidades.eyebrow')}</p>
        <h2 className="amenidades__title">{t('amenidades.titulo')}</h2>

        <div className={`amenidades__grid ${isVisible ? 'is-visible' : ''}`}>
          {amenidades.map(({ key, icon }) => (
            <div key={key} className="amenidades__item">
              <div className="amenidades__icon">{icon}</div>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>

        <div className={`actividades ${isVisible ? 'is-visible' : ''}`}>
          <p className="actividades__eyebrow">{t('amenidades.actividadesEyebrow')}</p>
          <div className="actividades__cards">
            {activities.map((a) => (
              <div
                key={a.id}
                className="actividades__card actividades__card--clickable"
                onClick={async () => {
                  trackEvent('activity_reg_intent', { activity_id: a.id, activity_name: a.name })
                  const numId = parseInt(a.id)
                  const ev = !isNaN(numId) && numId > 0 ? await getEventByActivityId(numId) : null
                  setLinkedEvent(ev)
                  setSelectedActivity(a)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    trackEvent('activity_reg_intent', { activity_id: a.id, activity_name: a.name })
                    const numId = parseInt(a.id)
                    const ev = !isNaN(numId) && numId > 0 ? await getEventByActivityId(numId) : null
                    setLinkedEvent(ev)
                    setSelectedActivity(a)
                  }
                }}
              >
                <div className="actividades__icon">{getActivityIcon(a.name)}</div>
                <div className="actividades__info">
                  <h3>{a.name}</h3>
                  {(a.fecha || a.hora) && (
                    <ul>
                      {a.fecha && (
                        <li>
                          <CalIcon />
                          <span><strong>{fmtFecha(a.fecha)}</strong></span>
                        </li>
                      )}
                      {a.hora && (
                        <li>
                          <ClockIcon />
                          <span>{fmtHora(a.hora)}</span>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                <span className="actividades__cta">Inscribirme →</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedActivity && (
        <ActivityRegModal
          activity={selectedActivity}
          event={linkedEvent}
          onClose={() => { setSelectedActivity(null); setLinkedEvent(null) }}
        />
      )}
    </section>
  )
}
