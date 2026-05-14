import { useState, useEffect, useRef } from 'react'

const DIAS = ['D','L','M','X','J','V','S']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export function DatePicker({ value, onChange, placeholder = 'Fecha' }) {
  const [open, setOpen]   = useState(false)
  const [view, setView]   = useState(() => {
    if (value) { const d = new Date(value + 'T00:00:00'); return { y: d.getFullYear(), m: d.getMonth() } }
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }
  })
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    if (value) { const d = new Date(value + 'T00:00:00'); setView({ y: d.getFullYear(), m: d.getMonth() }) }
  }, [value])

  const today = new Date()
  today.setHours(0,0,0,0)

  const firstDay = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()

  function prevMonth() { setView(v => v.m === 0 ? { y: v.y-1, m: 11 } : { y: v.y, m: v.m-1 }) }
  function nextMonth() { setView(v => v.m === 11 ? { y: v.y+1, m: 0 } : { y: v.y, m: v.m+1 }) }

  function selectDay(day) {
    const mm = String(view.m + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${view.y}-${mm}-${dd}`)
    setOpen(false)
  }

  function clear(e) { e.stopPropagation(); onChange('') }

  const displayVal = value
    ? (() => { const d = new Date(value + 'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` })()
    : ''

  const selectedDay = value
    ? (() => { const d = new Date(value + 'T00:00:00'); return d.getFullYear() === view.y && d.getMonth() === view.m ? d.getDate() : null })()
    : null

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="adm-dp" ref={ref}>
      <button type="button" className={`adm-dp__trigger ${value ? 'adm-dp__trigger--set' : ''}`} onClick={() => setOpen(o => !o)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{displayVal || placeholder}</span>
        {value && <span className="adm-dp__clear" onClick={clear}>✕</span>}
      </button>
      {open && (
        <div className="adm-dp__cal">
          <div className="adm-dp__cal-head">
            <button type="button" className="adm-dp__nav" onClick={prevMonth}>‹</button>
            <span className="adm-dp__cal-title">{MESES_CORTOS[view.m]} {view.y}</span>
            <button type="button" className="adm-dp__nav" onClick={nextMonth}>›</button>
          </div>
          <div className="adm-dp__days-head">
            {DIAS.map(d => <span key={d} className="adm-dp__dow">{d}</span>)}
          </div>
          <div className="adm-dp__grid">
            {cells.map((day, i) => {
              if (!day) return <span key={`e${i}`} />
              const isToday = today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === day
              const isSel   = selectedDay === day
              return (
                <button
                  key={day}
                  type="button"
                  className={`adm-dp__day ${isSel ? 'adm-dp__day--sel' : ''} ${isToday && !isSel ? 'adm-dp__day--today' : ''}`}
                  onClick={() => selectDay(day)}
                >{day}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const HOURS_12 = [12,1,2,3,4,5,6,7,8,9,10,11]
const MINS_60  = Array.from({length:60},(_,i)=>i)
const CELL_PX  = 36

export function TimePicker({ value, onChange, placeholder = 'Hora', variant = 'pill' }) {
  const [open, setOpen] = useState(false)
  const ref   = useRef(null)
  const hRef  = useRef(null)
  const mRef  = useRef(null)

  const parsed = (() => {
    if (!value) return { h12: null, min: null, ampm: 'am' }
    const [hStr, mStr] = value.split(':')
    const h24 = parseInt(hStr, 10)
    return { h12: h24 % 12 || 12, min: parseInt(mStr, 10), ampm: h24 >= 12 ? 'pm' : 'am' }
  })()

  const selH = parsed.h12, selMin = parsed.min, selAP = parsed.ampm

  function emit(h12, min, ampm) {
    const h24 = ampm === 'pm' ? (h12 % 12) + 12 : h12 % 12
    onChange(`${String(h24).padStart(2,'0')}:${String(min).padStart(2,'0')}`)
  }
  function pickHour(h)  { emit(h, selMin ?? 0, selAP) }
  function pickMin(m)   { emit(selH ?? 12, m, selAP) }
  function pickAP(ap)   { emit(selH ?? 12, selMin ?? 0, ap); setOpen(false) }

  useEffect(() => {
    if (!open) return
    if (hRef.current && selH !== null) {
      const idx = HOURS_12.indexOf(selH)
      if (idx >= 0) hRef.current.scrollTop = Math.max(0, idx * CELL_PX - CELL_PX)
    }
    if (mRef.current && selMin !== null) {
      mRef.current.scrollTop = Math.max(0, selMin * CELL_PX - CELL_PX)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const displayVal = value ? (() => {
    const [hStr, mStr] = value.split(':')
    const h24 = parseInt(hStr, 10)
    return `${h24 % 12 || 12}:${mStr} ${h24 >= 12 ? 'p.m.' : 'a.m.'}`
  })() : ''

  const isInput = variant === 'input'

  return (
    <div className="adm-tp" ref={ref}>
      <button type="button"
        className={isInput
          ? `adm-tp__trigger-input ${value ? 'adm-tp__trigger-input--set' : ''}`
          : `adm-dp__trigger ${value ? 'adm-dp__trigger--set' : ''}`}
        onClick={() => setOpen(o => !o)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>{displayVal || placeholder}</span>
        {value && <span className="adm-dp__clear" onClick={e => { e.stopPropagation(); onChange('') }}>✕</span>}
      </button>
      {open && (
        <div className="adm-tp__drop">
          <div className="adm-tp__head-row">
            <span>Hora</span>
            <span>Min</span>
            <span></span>
          </div>
          <div className="adm-tp__body">
            <div className="adm-tp__col" ref={hRef}>
              {HOURS_12.map(h => (
                <button key={h} type="button"
                  className={`adm-tp__cell ${selH === h ? 'adm-tp__cell--sel' : ''}`}
                  onClick={() => pickHour(h)}>
                  {String(h).padStart(2,'0')}
                </button>
              ))}
            </div>
            <div className="adm-tp__sep">:</div>
            <div className="adm-tp__col" ref={mRef}>
              {MINS_60.map(m => (
                <button key={m} type="button"
                  className={`adm-tp__cell ${selMin === m ? 'adm-tp__cell--sel' : ''}`}
                  onClick={() => pickMin(m)}>
                  {String(m).padStart(2,'0')}
                </button>
              ))}
            </div>
            <div className="adm-tp__col adm-tp__col--ap">
              {['am','pm'].map(ap => (
                <button key={ap} type="button"
                  className={`adm-tp__cell adm-tp__cell--ap ${selAP === ap ? 'adm-tp__cell--sel' : ''}`}
                  onClick={() => pickAP(ap)}>
                  {ap === 'am' ? 'a.m.' : 'p.m.'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
