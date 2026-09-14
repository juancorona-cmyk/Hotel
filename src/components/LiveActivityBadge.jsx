import { useState, useEffect } from 'react'
import { trackEvent, getLiveActivity } from '../lib/turso'
import './LiveActivityBadge.css'

export default function LiveActivityBadge() {
  const [activity, setActivity] = useState({ viewing: 0, booking: 0 })

  useEffect(() => {
    trackEvent('page_view')
    const heartbeat = setInterval(() => trackEvent('page_view'), 90_000)
    return () => clearInterval(heartbeat)
  }, [])

  useEffect(() => {
    const poll = () => getLiveActivity().then(setActivity)
    const id = setTimeout(poll, 3000)
    const interval = setInterval(poll, 25_000)
    return () => { clearTimeout(id); clearInterval(interval) }
  }, [])

  if (activity.booking > 0) {
    return (
      <div className="lab">
        <span className="lab__dot" />
        🔥 {activity.booking} {activity.booking === 1 ? 'persona está reservando' : 'personas están reservando'} ahora mismo
      </div>
    )
  }

  if (activity.viewing > 0) {
    return (
      <div className="lab">
        <span className="lab__dot" />
        👁 {activity.viewing} {activity.viewing === 1 ? 'persona más viendo' : 'personas más viendo'} esta página
      </div>
    )
  }

  return null
}
