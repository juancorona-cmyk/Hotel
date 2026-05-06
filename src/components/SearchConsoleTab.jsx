import { useState, useEffect, useCallback } from 'react'

const GSC_PERIODS = [
  { label: '7D',  days: 7  },
  { label: '28D', days: 28 },
  { label: '3M',  days: 90 },
]

function fmt(n) {
  if (n == null) return '–'
  return Math.round(n).toLocaleString('es-MX')
}
function fmtCTR(n) {
  if (n == null) return '–'
  return (n * 100).toFixed(1) + '%'
}
function fmtPos(n) {
  if (n == null) return '–'
  return n.toFixed(1)
}

function smoothPath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i]
    const mx = (p.x + c.x) / 2
    d += ` C ${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`
  }
  return d
}

function GscChart({ rows, days }) {
  if (!rows?.length) return <p className="adm-chart-empty">Sin datos aún</p>

  const allDays = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    allDays.push(d.toISOString().slice(0, 10))
  }
  const map = {}
  rows.forEach(r => { map[r.keys[0]] = r.clicks })
  const data = allDays.map(day => ({ day, label: day.slice(5), clicks: map[day] ?? 0 }))

  const W = 600, H = 150, PL = 8, PR = 8, PT = 16, PB = 22
  const cW = W - PL - PR
  const cH = H - PT - PB
  const maxVal = Math.max(...data.map(d => d.clicks), 1)
  const toX = i => PL + (i / (data.length - 1)) * cW
  const toY = v => PT + cH - (v / maxVal) * cH

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.clicks) }))
  const line = smoothPath(pts)
  const bottom = PT + cH
  const area = `${line} L ${pts.at(-1).x},${bottom} L ${PL},${bottom} Z`
  const gridY = [0.25, 0.5, 0.75].map(f => PT + cH - f * cH)
  const every = days <= 7 ? 1 : days <= 28 ? 2 : 7

  return (
    <div className="adm-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H + PB - 4}`} className="adm-svg-chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gGsc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4285f4" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#4285f4" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {gridY.map(y => (
          <line key={y} x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f3f3f3" strokeWidth="1"/>
        ))}
        <line x1={PL} y1={bottom} x2={W - PR} y2={bottom} stroke="#eee" strokeWidth="1"/>
        <path d={area} fill="url(#gGsc)"/>
        <path d={line} fill="none" stroke="#4285f4" strokeWidth="2" strokeLinecap="round"/>
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#4285f4" strokeWidth="1.5"/>
        ))}
        {data.map((d, i) => (
          i % every === 0 && (
            <text key={i} x={toX(i)} y={H + PB - 6} textAnchor="middle" className="adm-chart-xlabel">
              {d.label}
            </text>
          )
        ))}
      </svg>
      <div className="adm-chart-legend">
        <span className="adm-legend-dot" style={{ background: '#4285f4' }}/>
        <span className="adm-legend-text">Clics orgánicos</span>
      </div>
    </div>
  )
}

function GscCard({ label, value, sub, Icon }) {
  return (
    <div className="adm-card">
      <div className="adm-card__top">
        <span className="adm-card__label">{label}</span>
        <span className="adm-card__icon"><Icon /></span>
      </div>
      <div className="adm-card__num">{value}</div>
      <div className="adm-card__foot">
        <span className="adm-card__sub">{sub}</span>
      </div>
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="adm-gsc-setup">
      <div className="adm-gsc-setup__g">G</div>
      <p className="adm-gsc-setup__title">Google Search Console no configurado</p>
      <p className="adm-gsc-setup__desc">
        Agrega estas variables en Netlify → Site settings → Environment variables y vuelve a desplegar:
      </p>
      <div className="adm-gsc-setup__vars">
        <div><code>GOOGLE_SERVICE_ACCOUNT_JSON</code> — contenido completo del JSON de la cuenta de servicio</div>
        <div><code>GOOGLE_SITE_URL</code> — URL exacta del sitio en Search Console (ej: <code>https://hotelpuntagaleria.com/</code>)</div>
      </div>
      <p className="adm-gsc-setup__hint">
        La cuenta de servicio debe agregarse como usuario con rol "Lector de datos" en Google Search Console → Configuración → Usuarios y permisos.
      </p>
    </div>
  )
}

export default function SearchConsoleTab() {
  const [period, setPeriod] = useState(GSC_PERIODS[1])
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  const load = useCallback(async (days) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/.netlify/functions/gsc?days=${days}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error === 'not_configured') { setError('not_configured'); return }
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(period.days) }, [period, load])

  if (error === 'not_configured') return <NotConfigured />
  if (error) return <p className="adm-users__err" style={{ padding: '28px 0', textAlign: 'center' }}>Error: {error}</p>

  const t = data?.totals
  const dash = loading && !data ? '…' : '–'
  const clicks      = t ? fmt(t.clicks)           : dash
  const impressions = t ? fmt(t.impressions)       : dash
  const ctr         = t ? fmtCTR(t.ctr)           : dash
  const pos         = t ? fmtPos(t.position)       : dash

  return (
    <div>
      {/* Period selector */}
      <div className="adm-gsc-period">
        {GSC_PERIODS.map(p => (
          <button key={p.label}
            className={`adm-period-btn ${period.label === p.label ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p.label}
          </button>
        ))}
        {loading && <span className="adm-gsc-loading">Actualizando…</span>}
      </div>

      {/* Stat cards */}
      <div className="adm-section-lbl" style={{ marginTop: 16 }}>BÚSQUEDA ORGÁNICA · {period.label}</div>
      <div className="adm-grid4">
        <GscCard label="CLICS"        value={clicks}      sub="visitas desde Google"    Icon={IcoClick} />
        <GscCard label="IMPRESIONES"  value={impressions} sub="apariciones en resultados" Icon={IcoEye}   />
        <GscCard label="CTR"          value={ctr}         sub="tasa de clics promedio"  Icon={IcoPct}   />
        <GscCard label="POSICIÓN"     value={pos}         sub="posición promedio"        Icon={IcoPos}   />
      </div>

      {/* Chart */}
      <div className="adm-section-lbl">CLICS POR DÍA · {period.label}</div>
      <div className="adm-chart-panel" style={{ marginBottom: 20 }}>
        {loading && !data
          ? <p className="adm-chart-empty">Cargando…</p>
          : <GscChart rows={data?.byDay} days={period.days} />
        }
      </div>

      {/* Top queries table */}
      <div className="adm-section-lbl">CONSULTAS PRINCIPALES · {period.label}</div>
      <div className="adm-gsc-table-wrap">
        {!data?.byQuery?.length
          ? <p className="adm-chart-empty" style={{ padding: '20px 16px' }}>Sin datos de consultas</p>
          : (
            <table className="adm-gsc-table">
              <thead>
                <tr>
                  <th>Consulta</th>
                  <th>Clics</th>
                  <th>Impresiones</th>
                  <th>CTR</th>
                  <th>Posición</th>
                </tr>
              </thead>
              <tbody>
                {data.byQuery.map((q, i) => (
                  <tr key={i}>
                    <td className="adm-gsc-query">{q.keys[0]}</td>
                    <td>{Math.round(q.clicks)}</td>
                    <td>{Math.round(q.impressions)}</td>
                    <td>{(q.ctr * 100).toFixed(1)}%</td>
                    <td>{q.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}

function IcoClick() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-7 1-4 7z"/></svg>
}
function IcoEye() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
function IcoPct() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
}
function IcoPos() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
}
