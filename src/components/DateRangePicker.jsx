import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './DateRangePicker.css'

function clr(d) { const c = new Date(d); c.setHours(0,0,0,0); return c }
function toD(str) { if (!str) return null; const [y,m,d]=str.split('-').map(Number); return clr(new Date(y,m-1,d)) }
function toS(d) { if (!d) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

function eq(a, b) { return a && b && a.getTime() === b.getTime() }
function shiftMonth(y, m, n) { const d = new Date(y, m+n, 1); return { year: d.getFullYear(), month: d.getMonth() } }

function MonthGrid({ year, month, checkin, checkout, hover, step, onDay, onHover, minDate }) {
  const { t } = useTranslation()
  const MES = t('drp.meses', { returnObjects: true })
  const DIA = t('drp.dias', { returnObjects: true })

  const ci = toD(checkin), co = toD(checkout), hv = toD(hover), mn = toD(minDate)
  const rangeEnd = step === 'checkout' ? (hv || co) : co
  const todayD = clr(new Date())

  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const total  = new Date(year, month + 1, 0).getDate()

  const cells = Array(offset).fill(null)
  for (let d = 1; d <= total; d++) cells.push(clr(new Date(year, month, d)))

  return (
    <div className="drp-month">
      <p className="drp-month__name">{MES[month]} {year}</p>
      <div className="drp-month__grid">
        {DIA.map(d => <span key={d} className="drp-dh">{d}</span>)}
        {cells.map((dt, i) => {
          if (!dt) return <span key={`e${i}`} />

          const off    = mn && dt < mn
          const isS    = eq(dt, ci)
          const isE    = eq(dt, co)
          const isHE   = eq(dt, hv) && step === 'checkout' && !isE
          const inR    = ci && rangeEnd && dt > ci && dt < rangeEnd
          const hasEnd = ci && (co || (hv && step === 'checkout'))
          const isToday= eq(dt, todayD) && !isS && !isE

          // week-row edge: first col = Monday, last = Sunday
          const col = (dt.getDay() + 6) % 7
          const isMonday = col === 0
          const isSunday = col === 6
          const isFirst  = dt.getDate() === 1
          const isLast   = dt.getDate() === new Date(year, month+1, 0).getDate()

          const noLeftFill  = isMonday || isFirst
          const noRightFill = isSunday || isLast

          return (
            <button
              key={i}
              type="button"
              disabled={off}
              className={[
                'drp-day',
                off  ? 'is-off'   : '',
                isS  ? 'is-start' : '',
                isE  ? 'is-end'   : '',
                isHE ? 'is-hover-end' : '',
                inR  ? 'is-range'  : '',
                hasEnd && isS ? 'is-start-ranged' : '',
                isToday ? 'is-today' : '',
                noLeftFill  ? 'no-left'  : '',
                noRightFill ? 'no-right' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => !off && onDay(toS(dt))}
              onMouseEnter={() => !off && onHover(toS(dt))}
            >
              <span className="drp-day__n">{dt.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DateRangePicker({ checkin, checkout, onChange, minDate }) {
  const { t } = useTranslation()
  const todayD = clr(new Date())
  const initView = () => {
    const d = checkin ? toD(checkin) : todayD
    return { year: d.getFullYear(), month: d.getMonth() }
  }

  const [open,  setOpen]  = useState(false)
  const [step,  setStep]  = useState('checkin')
  const [hover, setHover] = useState(null)
  const [view,  setView]  = useState(initView)
  const [tempCI, setTempCI] = useState(checkin)

  const next = shiftMonth(view.year, view.month, 1)
  const todayStr = toS(todayD)
  const canPrev = view.year > todayD.getFullYear() || (view.year === todayD.getFullYear() && view.month > todayD.getMonth())

  const disp = (str) => {
    if (!str) return null
    const d = toD(str)
    const ms = t('drp.mesesCorto', { returnObjects: true })
    return `${d.getDate()} ${ms[d.getMonth()]} ${d.getFullYear()}`
  }

  const openFor = (which) => {
    if (open && step === which) { setOpen(false); return }
    setStep(which)
    setTempCI(checkin)
    setOpen(true)
  }

  const handleDay = (dateStr) => {
    if (step === 'checkin') {
      onChange(dateStr, null)
      setTempCI(dateStr)
      setStep('checkout')
    } else {
      const ci = toD(tempCI || checkin)
      const co = toD(dateStr)
      if (co <= ci) {
        onChange(dateStr, null)
        setTempCI(dateStr)
        setStep('checkout')
      } else {
        onChange(tempCI || checkin, dateStr)
        setHover(null)
        setOpen(false)
        setStep('checkin')
      }
    }
  }

  const clear = () => { onChange(null, null); setTempCI(null); setStep('checkin') }

  const displayCI = step === 'checkout' && tempCI ? tempCI : checkin

  return (
    <div className="drp">
      {/* Field buttons */}
      <div className="drp-fields">
        <button
          type="button"
          className={`drp-field ${open && step === 'checkin' ? 'drp-field--active' : ''}`}
          onClick={() => openFor('checkin')}
        >
          <span className="drp-field__lbl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            {t('drp.llegada')}
          </span>
          <span className={`drp-field__val ${!displayCI ? 'drp-field__val--empty' : ''}`}>
            {disp(displayCI) || t('drp.anadirFecha')}
          </span>
        </button>

        <span className="drp-fields__sep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>

        <button
          type="button"
          className={`drp-field ${open && step === 'checkout' ? 'drp-field--active' : ''}`}
          onClick={() => openFor('checkout')}
        >
          <span className="drp-field__lbl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            {t('drp.salida')}
          </span>
          <span className={`drp-field__val ${!checkout ? 'drp-field__val--empty' : ''}`}>
            {disp(checkout) || t('drp.anadirFecha')}
          </span>
        </button>
      </div>

      {/* Calendar panel */}
      {open && (
        <div className="drp-panel" onMouseLeave={() => setHover(null)}>
          <div className="drp-panel__top">
            <p className="drp-panel__hint">
              {step === 'checkin' ? t('drp.cuandoLlegas') : t('drp.cuandoTeVas')}
            </p>
            <div className="drp-panel__nav">
              <button type="button" className="drp-nav" onClick={() => setView(v => shiftMonth(v.year, v.month, -1))} disabled={!canPrev} aria-label={t('drp.borrar')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button type="button" className="drp-nav" onClick={() => setView(v => shiftMonth(v.year, v.month, 1))} aria-label={t('drp.listo')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          <div className="drp-months">
            <MonthGrid year={view.year}  month={view.month}  checkin={displayCI} checkout={checkout} hover={hover} step={step} onDay={handleDay} onHover={setHover} minDate={minDate || todayStr} />
            <MonthGrid year={next.year}  month={next.month}  checkin={displayCI} checkout={checkout} hover={hover} step={step} onDay={handleDay} onHover={setHover} minDate={minDate || todayStr} />
          </div>

          <div className="drp-panel__footer">
            <button type="button" className="drp-clear" onClick={clear}>{t('drp.borrar')}</button>
            <button type="button" className="drp-done" onClick={() => setOpen(false)}>
              {t('drp.listo')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
