import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getStats, clearEvents, clearActivityInscriptions,
  adminLoginSingle, adminVerifyToken, adminCreateUser, adminGetUsers, adminDeleteUser, adminChangePassword, adminSetPermissions,
  getActivities, saveActivity, deleteActivity, updateActivity,
  getEvents, createEvent, updateEvent, deleteEvent, getRegistrationsByEvent,
  getAllActivityRegistrations, getEventByActivityId, upsertActivityEvent,
  deleteActivityRegistration, getActivityRegistrationsByEvent,
  deleteEventRegistration, getActivityRegistrationIntents, getHotelReservationEvents,
  deleteBotEvent, updateActivityRegistrationPayment,
  getRegistrationById, checkInRegistration, undoCheckInRegistration,
  API_BASE
} from '../lib/turso'
import { getActivityIcon } from '../lib/activityIcons'
import { fmtFecha as _fmtFecha, fmtHora } from '../lib/utils'
import SearchConsoleTab from './SearchConsoleTab'
import { DatePicker } from './common/DateTimePickers'
import './AdminDashboard.css'

function fmtFecha(s) {
  return _fmtFecha(s, false)
}

// Decodes the payload of a JWT without verifying the signature (client-side read-only).
// Verification happens server-side in auth.js.
function decodeJWT(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch { return null }
}

function tokenFromStorage() {
  const token = sessionStorage.getItem('adm_token')
  if (!token) return null
  const p = decodeJWT(token)
  if (!p || p.exp < Math.floor(Date.now() / 1000)) {
    sessionStorage.removeItem('adm_token')
    return null
  }
  return { token, payload: p }
}

const PERIODS = [
  { label: '24H', days: 1 },
  { label: '7D',  days: 7 },
  { label: '28D', days: 28 },
  { label: '3M',  days: 90 },
  { label: 'Todo', days: 0 },
]

const PERMS_CONFIG = [
  { key: 'stats',         label: 'Estadísticas'  },
  { key: 'google',        label: 'Google'         },
  { key: 'actividades',   label: 'Actividades'    },
  { key: 'eventos',       label: 'Eventos'        },
  { key: 'reservas',      label: 'Reservas Hotel' },
  { key: 'inscripciones', label: 'Inscripciones Actividades'  },
  { key: 'reportes',      label: 'Reportes'       },
]

// Agrupación de tabs en menús desplegables (barra más limpia)
const TAB_GROUPS = [
  { id: 'metricas',      label: 'Métricas',      items: [['stats', 'Estadísticas'], ['google', 'Google'], ['reportes', 'Reportes']] },
  { id: 'reservaciones', label: 'Reservaciones', items: [['reservas', 'Reservas'], ['inscripciones', 'Inscripciones']] },
  { id: 'contenido',     label: 'Contenido',     items: [['contenido', 'Actividades y Eventos']] },
]

// ── Labels ────────────────────────────────────────────────
const WA_LABELS = {
  float:           'Botón flotante',
  bot_contact:     'Bot — Contacto',
  bot_activity:    'Bot — Actividad',
  salon:           'Salón de eventos',
  restaurante:     'Restaurante',
  ubicacion:       'Ubicación',
  footer_social:   'Footer — Social',
  footer_reservar: 'Footer — Reservar',
  booking_modal:   'Modal de reserva',
}

const RESERVA_LABELS = {
  hero:         'Hero (portada)',
  rooms:        'Habitaciones',
  booking_modal: 'Modal de reserva',
}

// ── Reportes: rangos por mes / semana ────────────────────
function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function monthOptions(n = 12) {
  const now = new Date(), out = []
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) })
  }
  return out
}
function monthRange(value) {
  const [y, m] = value.split('-').map(Number)
  const from = new Date(y, m - 1, 1), to = new Date(y, m, 0)
  return { from: ymdLocal(from), to: ymdLocal(to), label: from.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) }
}
function weekOptions(n = 12) {
  const now = new Date(), out = []
  const offMon = (now.getDay() + 6) % 7
  const monday = new Date(now); monday.setDate(now.getDate() - offMon)
  for (let i = 0; i < n; i++) {
    const start = new Date(monday); start.setDate(monday.getDate() - i * 7)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    out.push({ value: ymdLocal(start), label: `${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}` })
  }
  return out
}
function weekRange(value) {
  const start = new Date(value + 'T00:00:00'), end = new Date(value + 'T00:00:00')
  end.setDate(end.getDate() + 6)
  return { from: ymdLocal(start), to: ymdLocal(end), label: `${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} al ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}` }
}
function presetRange(type) {
  const now = new Date()
  const to = ymdLocal(now)
  const f = new Date(now)
  if (type === '7d') f.setDate(f.getDate() - 6)
  else if (type === '1m') f.setMonth(f.getMonth() - 1)
  else if (type === '3m') f.setMonth(f.getMonth() - 3)
  const label = type === '7d' ? 'Últimos 7 días' : type === '1m' ? 'Último mes' : 'Últimos 3 meses'
  return { from: ymdLocal(f), to, label }
}
function inDateRange(created_at, from, to) {
  const d = (created_at || '').slice(0, 10)
  return d >= from && d <= to
}
function aggregateReservas(rows, from, to) {
  const conf = rows.filter(r => r.event_type === 'reserva_confirmada' && inDateRange(r.created_at, from, to))
  const clk  = rows.filter(r => r.event_type === 'reserva_click'      && inDateRange(r.created_at, from, to))
  const byRoom = {}, bySource = {}, byDay = {}
  let nights = 0
  conf.forEach(r => {
    const room = (r.room || 'Sin especificar')
    byRoom[room] = (byRoom[room] || 0) + 1
    const src = RESERVA_LABELS[r.source] || r.source || 'Directo'
    bySource[src] = (bySource[src] || 0) + 1
    const day = (r.created_at || '').slice(0, 10)
    byDay[day] = (byDay[day] || 0) + 1
    nights += Number(r.nights || 0)
  })
  const sortDesc = o => Object.entries(o).sort((a, b) => b[1] - a[1])
  const byRoomArr = sortDesc(byRoom)
  return {
    confirmed: conf.length, intents: clk.length,
    conversion: clk.length ? Math.round((conf.length / clk.length) * 100) : 0,
    nights, avgNights: conf.length ? (nights / conf.length).toFixed(1) : '0',
    byRoom: byRoomArr, bySource: sortDesc(bySource),
    byDay: Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])),
    topRoom: byRoomArr[0]?.[0] || '—',
  }
}
function aggregateInscripciones(regs, from, to) {
  const list = regs.filter(r => inDateRange(r.created_at, from, to))
  const paid = list.filter(r => Number(r.paid) === 1).length
  const byEvent = {}
  list.forEach(r => { const e = r.event_name || r.activity_name || 'General'; byEvent[e] = (byEvent[e] || 0) + 1 })
  return { total: list.length, paid, pending: list.length - paid, byEvent: Object.entries(byEvent).sort((a, b) => b[1] - a[1]) }
}

// ── Reportes: HTML para PDF (blanco, identidad Hotel Punta Galería) ───────────
const HOTEL_OLIVE = '#5a6c1e'
const REP_PALETTE = ['#5a6c1e', '#8fa030', '#b5c840', '#cdd98a', '#7a8c2e', '#a4b65a', '#dfe3c0']
function escHtml(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}
function dateList(from, to) {
  const out = [], d = new Date(from + 'T00:00:00'), end = new Date(to + 'T00:00:00')
  let guard = 0
  while (d <= end && guard < 800) { out.push(ymdLocal(d)); d.setDate(d.getDate() + 1); guard++ }
  return out
}
// Agrupa el rango en <=14 cubetas (diario en rangos cortos, semanal/mensual en largos).
function bucketReservas(rows, from, to) {
  const days = dateList(from, to)
  const confByDay = {}, intByDay = {}
  rows.forEach(r => {
    const day = (r.created_at || '').slice(0, 10)
    if (day < from || day > to) return
    if (r.event_type === 'reserva_confirmada') confByDay[day] = (confByDay[day] || 0) + 1
    else if (r.event_type === 'reserva_click') intByDay[day] = (intByDay[day] || 0) + 1
  })
  const size = Math.ceil(days.length / 14) || 1
  const labels = [], conf = [], inten = []
  for (let i = 0; i < days.length; i += size) {
    const chunk = days.slice(i, i + size)
    conf.push(chunk.reduce((s, d) => s + (confByDay[d] || 0), 0))
    inten.push(chunk.reduce((s, d) => s + (intByDay[d] || 0), 0))
    const a = chunk[0], b = chunk[chunk.length - 1]
    labels.push(size === 1 ? `${a.slice(8, 10)}/${a.slice(5, 7)}` : `${a.slice(8, 10)}-${b.slice(8, 10)}/${b.slice(5, 7)}`)
  }
  return { labels, conf, inten }
}
function svgGroupedBars({ labels, conf, inten }) {
  const W = 640, H = 220, PL = 34, PR = 14, PT = 16, PB = 34
  const cW = W - PL - PR, cH = H - PT - PB
  const max = Math.max(1, ...conf, ...inten)
  const n = Math.max(1, labels.length)
  const slot = cW / n
  const bw = Math.max(4, Math.min(15, slot / 2 - 3))
  const yBase = PT + cH
  let grid = ''
  for (let g = 0; g <= 4; g++) {
    const y = PT + (cH * g) / 4
    const val = Math.round(max * (1 - g / 4))
    grid += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#eef0e2" stroke-width="1"/>`
    grid += `<text x="${PL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#aab089">${val}</text>`
  }
  const step = Math.ceil(n / 12)
  let bars = '', xl = ''
  labels.forEach((lb, i) => {
    const cx = PL + slot * i + slot / 2
    const h1 = (conf[i] / max) * cH, h2 = (inten[i] / max) * cH
    bars += `<rect x="${cx - bw - 1}" y="${yBase - h1}" width="${bw}" height="${h1}" rx="2" fill="#5a6c1e"/>`
    bars += `<rect x="${cx + 1}" y="${yBase - h2}" width="${bw}" height="${h2}" rx="2" fill="#b5c840"/>`
    if (i % step === 0) xl += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="9" fill="#8a9170">${escHtml(lb)}</text>`
  })
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="height:auto;display:block;" preserveAspectRatio="xMidYMid meet">${grid}<line x1="${PL}" y1="${yBase}" x2="${W - PR}" y2="${yBase}" stroke="#dfe3d0" stroke-width="1"/>${bars}${xl}</svg>`
}
function donutSvg(entries, size = 150) {
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1
  const cx = size / 2, cy = size / 2, r = size * 0.413, ri = size * 0.253
  let a0 = -Math.PI / 2, paths = ''
  entries.forEach(([, v], i) => {
    const frac = v / total
    if (frac <= 0) return
    let a1 = a0 + frac * 2 * Math.PI
    if (frac >= 0.9999) a1 = a0 + 2 * Math.PI - 0.0001
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const xi0 = cx + ri * Math.cos(a0), yi0 = cy + ri * Math.sin(a0)
    const xi1 = cx + ri * Math.cos(a1), yi1 = cy + ri * Math.sin(a1)
    const large = (a1 - a0) > Math.PI ? 1 : 0
    paths += `<path d="M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${ri} ${ri} 0 ${large} 0 ${xi0} ${yi0} Z" fill="${REP_PALETTE[i % REP_PALETTE.length]}"/>`
    a0 = a1
  })
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="flex:none;">${paths}<text x="${cx}" y="${cy + size * 0.055}" text-anchor="middle" font-size="${(size * 0.16).toFixed(1)}" font-weight="800" fill="#5a6c1e">${total}</text></svg>`
}
function pieBlockHtml(entries, size = 150) {
  const total = entries.reduce((s, [, v]) => s + v, 0)
  const compact = size < 120
  const fs = compact ? 10 : 12
  if (!total) return `<p style="color:#aab089;font-style:italic;font-size:${fs}px;padding:6px 0;">Sin datos en el período</p>`
  const legend = entries.map(([k, v], i) =>
    `<div style="display:flex;align-items:center;gap:6px;font-size:${fs}px;margin-bottom:${compact ? 4 : 6}px;"><span style="width:9px;height:9px;border-radius:3px;background:${REP_PALETTE[i % REP_PALETTE.length]};display:inline-block;flex:none;"></span><span style="flex:1;text-transform:capitalize;color:#3a4220;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(k)}</span><strong style="color:#5a6c1e;">${v}</strong><span style="color:#9aa07e;">${Math.round((v / total) * 100)}%</span></div>`
  ).join('')
  return `<div style="display:flex;align-items:center;gap:${compact ? 12 : 16}px;">${donutSvg(entries, size)}<div style="flex:1;min-width:0;">${legend}</div></div>`
}
function barsLegendHtml() {
  return `<div style="display:flex;gap:18px;justify-content:center;margin-top:6px;font-size:11px;color:#6b7350;font-weight:600;">
    <span style="display:flex;align-items:center;gap:6px;"><span style="width:11px;height:11px;border-radius:3px;background:#5a6c1e;"></span>Confirmadas</span>
    <span style="display:flex;align-items:center;gap:6px;"><span style="width:11px;height:11px;border-radius:3px;background:#b5c840;"></span>Intentos</span>
  </div>`
}

function buildHotelReportHTML({ periodLabel, modeLabel, agg, ins, bk, web }) {
  const esc = escHtml
  const genDate = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const topN = (arr, n = 6) => {
    if (arr.length <= n) return arr
    const rest = arr.slice(n - 1).reduce((s, [, v]) => s + v, 0)
    return [...arr.slice(0, n - 1), ['Otros', rest]]
  }
  const kpi = (val, label, sub) => `
    <div class="kpi">
      <div class="kpi-val">${esc(val)}</div>
      <div class="kpi-lbl">${esc(label)}</div>
      ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}
    </div>`
  const wv = (v) => web && web.ok ? web[v] : '—'

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:100%; height:100%; }
  body { font-family:'Montserrat',sans-serif; background:#fff; color:#1d2410; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:A4 landscape; margin:0; }
  .sheet { width:297mm; height:210mm; padding:10mm 13mm; display:flex; flex-direction:column; overflow:hidden; }
  .head { text-align:center; border-bottom:3px solid ${HOTEL_OLIVE}; padding-bottom:9px; margin-bottom:10px; position:relative; }
  .brand { font-size:11px; letter-spacing:4px; text-transform:uppercase; color:${HOTEL_OLIVE}; font-weight:700; }
  .title { font-size:24px; font-weight:800; margin-top:2px; letter-spacing:.3px; }
  .period { font-size:12px; color:#5b6347; margin-top:3px; font-weight:600; text-transform:capitalize; }
  .meta { position:absolute; right:0; bottom:9px; text-align:right; font-size:9.5px; color:#8a9170; line-height:1.5; }
  .meta strong { color:${HOTEL_OLIVE}; font-size:11px; }
  h2 { font-size:10px; letter-spacing:1.2px; text-transform:uppercase; color:${HOTEL_OLIVE}; margin:0 0 8px; font-weight:700; text-align:center; }
  .kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:9px; margin-bottom:9px; }
  .kpi { border:1px solid #e7ead9; border-radius:12px; padding:11px 10px; background:#fafbf5; text-align:center; }
  .kpi-val { font-size:24px; font-weight:800; color:${HOTEL_OLIVE}; line-height:1; }
  .kpi-lbl { font-size:9px; text-transform:uppercase; letter-spacing:.5px; color:#6b7350; margin-top:6px; font-weight:700; }
  .kpi-sub { font-size:8.5px; color:#9aa07e; margin-top:2px; }
  .webstrip { display:grid; grid-template-columns:108px repeat(4,1fr); gap:9px; align-items:stretch; margin-bottom:11px; }
  .webstrip .kpi { background:#f1f5e4; }
  .webstrip-tag { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-size:9.5px; font-weight:800; letter-spacing:.8px; text-transform:uppercase; color:#fff; background:${HOTEL_OLIVE}; border-radius:12px; padding:8px; line-height:1.35; }
  .main { flex:1; display:grid; grid-template-columns:1.5fr 1fr; gap:11px; min-height:0; margin-bottom:11px; }
  .panel { border:1px solid #e7ead9; border-radius:13px; padding:12px 14px; background:#fff; display:flex; flex-direction:column; min-height:0; }
  .panel.grow svg { flex:1; min-height:0; }
  .stat-rows { display:flex; flex-direction:column; gap:7px; margin-top:2px; }
  .stat-row { display:flex; align-items:center; gap:9px; }
  .stat-name { flex:1; font-size:11.5px; font-weight:600; color:#3a4220; text-transform:capitalize; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .stat-bar { flex:1.3; height:9px; background:#eef0e2; border-radius:5px; overflow:hidden; }
  .stat-fill { display:block; height:100%; background:${HOTEL_OLIVE}; border-radius:5px; }
  .stat-num { width:58px; text-align:right; font-size:11.5px; font-weight:700; color:${HOTEL_OLIVE}; }
  .donuts { display:grid; grid-template-columns:repeat(3,1fr); gap:11px; }
  .barleg { display:flex; gap:16px; justify-content:center; margin-top:5px; font-size:10px; color:#6b7350; font-weight:600; }
  .barleg span span { width:10px; height:10px; border-radius:3px; display:inline-block; margin-right:5px; }
  .foot { border-top:1px solid #e7ead9; padding-top:8px; font-size:9px; color:#aab089; text-align:center; letter-spacing:.5px; }
  .empty { color:#aab089; font-style:italic; font-size:11px; padding:6px 0; text-align:center; }
</style></head><body>
  <div class="sheet">
    <div class="head">
      <div class="brand">Hotel Punta Galería</div>
      <div class="title">Reporte General de la Página</div>
      <div class="period">${esc(modeLabel)}: ${esc(periodLabel)}</div>
      <div class="meta">Generado<br><strong>${esc(genDate)}</strong></div>
    </div>

    <div class="kpis">
      ${kpi(wv('clics'), 'Visitas web', 'desde Google')}
      ${kpi(agg.confirmed, 'Reservas', 'confirmadas')}
      ${kpi(agg.intents, 'Intentos', 'de reserva')}
      ${kpi(agg.conversion + '%', 'Conversión', 'conf. / intentos')}
      ${kpi(ins.total, 'Inscripciones', ins.paid + ' pagadas')}
    </div>

    <div class="webstrip">
      <div class="webstrip-tag">Tráfico web<br>Google</div>
      ${kpi(wv('impresiones'), 'Impresiones', 'en Google')}
      ${kpi(wv('clics'), 'Visitas (clics)', 'desde Google')}
      ${kpi(wv('ctr'), 'CTR', 'tasa de clics')}
      ${kpi(wv('pos'), 'Posición media', 'en resultados')}
    </div>

    <div class="main">
      <div class="panel grow">
        <h2>Reservas por período — confirmadas vs intentos</h2>
        ${svgGroupedBars(bk)}
        <div class="barleg"><span><span style="background:#5a6c1e;"></span>Confirmadas</span><span><span style="background:#b5c840;"></span>Intentos</span></div>
      </div>
      <div class="panel">
        <h2>Noches y desempeño</h2>
        <div class="stat-rows">
          ${statRow('Noches reservadas', agg.nights, Math.max(agg.nights, agg.confirmed, 1))}
          ${statRow('Reservas confirmadas', agg.confirmed, Math.max(agg.intents, agg.confirmed, 1))}
          ${statRow('Intentos de reserva', agg.intents, Math.max(agg.intents, agg.confirmed, 1))}
          ${statRow('Inscripciones', ins.total, Math.max(ins.total, agg.confirmed, 1))}
          ${statRow('Inscripciones pagadas', ins.paid, Math.max(ins.total, 1))}
        </div>
        <div style="margin-top:auto;padding-top:8px;font-size:10px;color:#8a9170;text-align:center;">
          Promedio ${esc(agg.avgNights)} noches por reserva · CTR web ${esc(wv('ctr'))}
        </div>
      </div>
    </div>

    <div class="donuts">
      <div class="panel"><h2>Por habitación</h2>${pieBlockHtml(topN(agg.byRoom), 84)}</div>
      <div class="panel"><h2>Origen de la reserva</h2>${pieBlockHtml(topN(agg.bySource), 84)}</div>
      <div class="panel"><h2>Inscripciones por evento</h2>${pieBlockHtml(topN(ins.byEvent), 84)}</div>
    </div>

    <div class="foot">Hotel Punta Galería · Reporte general (web + reservas) · ${esc(periodLabel)}</div>
  </div>
</body></html>`
}

function statRow(name, val, max) {
  const pct = max ? Math.round((Number(val) / max) * 100) : 0
  return `<div class="stat-row"><span class="stat-name">${escHtml(name)}</span><span class="stat-bar"><span class="stat-fill" style="width:${pct}%"></span></span><span class="stat-num">${escHtml(val)}</span></div>`
}

// ── Helpers ──────────────────────────────────────────────
function cnt(data, type) {
  return Number(data?.find(r => r.event_type === type)?.cnt ?? 0)
}
function total(data) {
  return data?.reduce((s, r) => s + Number(r.cnt), 0) ?? 0
}
function diff(a, b) {
  const d = a - b
  return d === 0 ? null : d
}
function todayLabel() {
  return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).toUpperCase()
}
function clock() {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
// SQLite stores datetime('now') as UTC without 'Z' — append it so JS parses correctly
function parseDBDate(str) {
  if (!str) return new Date(NaN)
  const s = str.trim()
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s.replace(' ', 'T') + 'Z')
}
function fmtDBDate(str) {
  return parseDBDate(str).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  })
}

// ── Fill last 14 days ────────────────────────────────────
function buildChartData(byDayType) {
  const days = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const map = {}
  byDayType?.forEach(r => {
    if (!map[r.day]) map[r.day] = {}
    map[r.day][r.event_type] = Number(r.cnt)
  })
  return days.map(day => ({
    day,
    label: day.slice(5),
    messages: map[day]?.bot_message ?? 0,
    whatsapp: map[day]?.whatsapp_click ?? 0,
  }))
}

// ── Smooth SVG line ──────────────────────────────────────
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

// ── Line chart ───────────────────────────────────────────
function LineChart({ data }) {
  if (!data?.length) return <p className="adm-chart-empty">Sin datos aún</p>

  const W = 600, H = 150, PL = 8, PR = 8, PT = 16, PB = 22
  const cW = W - PL - PR
  const cH = H - PT - PB
  const maxVal = Math.max(...data.map(d => Math.max(d.messages, d.whatsapp)), 1)
  const toX = i  => PL + (i / (data.length - 1)) * cW
  const toY = v  => PT + cH - (v / maxVal) * cH

  const mPts = data.map((d, i) => ({ x: toX(i), y: toY(d.messages) }))
  const wPts = data.map((d, i) => ({ x: toX(i), y: toY(d.whatsapp) }))

  const mLine = smoothPath(mPts)
  const wLine = smoothPath(wPts)
  const bottom = PT + cH
  const mArea = `${mLine} L ${mPts.at(-1).x},${bottom} L ${PL},${bottom} Z`
  const wArea = `${wLine} L ${wPts.at(-1).x},${bottom} L ${PL},${bottom} Z`

  const gridY = [0.25, 0.5, 0.75].map(f => PT + cH - f * cH)

  return (
    <div className="adm-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H + PB - 4}`} className="adm-svg-chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a8c2e" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#7a8c2e" stopOpacity="0.02"/>
          </linearGradient>
          <linearGradient id="gWA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#25d366" stopOpacity="0.14"/>
            <stop offset="100%" stopColor="#25d366" stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {gridY.map(y => (
          <line key={y} x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f3f3f3" strokeWidth="1"/>
        ))}
        <line x1={PL} y1={bottom} x2={W - PR} y2={bottom} stroke="#eee" strokeWidth="1"/>

        <path d={mArea} fill="url(#gMsg)"/>
        <path d={wArea} fill="url(#gWA)"/>

        <path d={mLine} fill="none" stroke="#7a8c2e" strokeWidth="2" strokeLinecap="round"/>
        <path d={wLine} fill="none" stroke="#25d366" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 3"/>

        {mPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#7a8c2e" strokeWidth="1.5"/>
        ))}
        {wPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" stroke="#25d366" strokeWidth="1.5"/>
        ))}

        {data.map((d, i) => (
          i % 2 === 0 && (
            <text key={i} x={toX(i)} y={H + PB - 6} textAnchor="middle" className="adm-chart-xlabel">
              {d.label}
            </text>
          )
        ))}
      </svg>

      <div className="adm-chart-legend">
        <span className="adm-legend-dot" style={{ background: '#7a8c2e' }} />
        <span className="adm-legend-text">Mensajes</span>
        <span className="adm-legend-dash" />
        <span className="adm-legend-text">WhatsApp</span>
      </div>
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────
function StatCard({ label, value, sub, Icon, delta: d }) {
  const positive = d > 0, negative = d < 0
  return (
    <div className="adm-card">
      <div className="adm-card__top">
        <span className="adm-card__label">{label}</span>
        <span className="adm-card__icon"><Icon /></span>
      </div>
      <div className="adm-card__num">{value ?? '–'}</div>
      <div className="adm-card__foot">
        <span className="adm-card__sub">{sub}</span>
        {d != null && (
          <span className={`adm-delta ${positive ? 'up' : negative ? 'down' : ''}`}>
            {positive ? `+${d}` : `${d}`}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Conversions ───────────────────────────────────────────
function ConversionList({ data, labels, color }) {
  const tot = data?.reduce((s, r) => s + Number(r.cnt), 0) ?? 0
  if (!data?.length) return <p className="adm-conv-empty">Sin datos aún</p>
  return (
    <div className="adm-conv-list">
      {data.map((r, i) => {
        const c   = Number(r.cnt)
        const pct = tot > 0 ? Math.round((c / tot) * 100) : 0
        return (
          <div key={i} className="adm-conv-item">
            <span className="adm-conv-src">{labels[r.source] ?? r.source ?? '—'}</span>
            <div className="adm-conv-bar-bg">
              <div className="adm-conv-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="adm-conv-num">{c}</span>
            <span className="adm-conv-pct">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Distribution ─────────────────────────────────────────
function Distribution({ byType }) {
  const t = total(byType)
  const rows = [
    { type: 'bot_open',       label: 'Bot abierto',      color: '#7a8c2e' },
    { type: 'bot_message',    label: 'Mensajes enviados', color: '#3b82f6' },
    { type: 'whatsapp_click', label: 'Clicks WhatsApp',   color: '#25d366' },
  ]
  return (
    <div className="adm-dist">
      {rows.map(r => {
        const c = cnt(byType, r.type)
        const pct = t > 0 ? Math.round((c / t) * 100) : 0
        return (
          <div key={r.type} className="adm-dist__row">
            <span className="adm-dist__dot" style={{ background: r.color }}/>
            <span className="adm-dist__label">{r.label}</span>
            <div className="adm-dist__bar-bg">
              <div className="adm-dist__bar-fill" style={{ width: `${pct}%`, background: r.color }}/>
            </div>
            <span className="adm-dist__num">{c}</span>
            <span className="adm-dist__pct">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Users section ─────────────────────────────────────────
function UsersSection({ currentUser, userRole }) {
  const [users, setUsers]       = useState([])
  const [loadingU, setLoadingU] = useState(false)
  const [newUser, setNewUser]   = useState('')
  const [newPwd, setNewPwd]     = useState('')
  const [newRole, setNewRole]   = useState('editor')
  const [newMustChange, setNewMustChange] = useState(true)
  const [showNew, setShowNew]   = useState(false)
  const [creating, setCreating] = useState(false)
  const [errU, setErrU]         = useState('')
  const [changePwd, setChangePwd] = useState({ open: false, user: '', val: '', show: false })
  const [permModal, setPermModal] = useState(null)
  const [savingPerms, setSavingPerms] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoadingU(true)
    setUsers(await adminGetUsers())
    setLoadingU(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const create = async (e) => {
    e.preventDefault()
    if (!newUser.trim() || newPwd.length < 6) { setErrU('Mínimo 6 caracteres en la contraseña'); return }
    setCreating(true); setErrU('')
    try {
      await adminCreateUser(newUser.trim(), newPwd, newRole, newMustChange)
      setNewUser(''); setNewPwd(''); setNewRole('editor'); setNewMustChange(true); loadUsers()
    } catch { setErrU('Error al crear usuario') }
    finally { setCreating(false) }
  }

  const del = async (id, username, targetRole) => {
    if (username === currentUser) { alert('No puedes eliminar tu propio usuario'); return }
    if (userRole !== 'admin' && targetRole === 'admin') { alert('No tienes permisos para eliminar a un administrador'); return }
    if (!confirm(`¿Eliminar usuario "${username}"?`)) return
    await adminDeleteUser(id); loadUsers()
  }

  const saveChange = async (e) => {
    e.preventDefault()
    if (changePwd.val.length < 6) { setErrU('Mínimo 6 caracteres'); return }
    setCreating(true); setErrU('')
    try {
      await adminChangePassword(changePwd.user, changePwd.val)
      setChangePwd({ open: false, user: '', val: '', show: false })
    } catch { setErrU('Error al cambiar contraseña') }
    finally { setCreating(false) }
  }

  const togglePerm = (key) => {
    // Optimista y con estado funcional: permite marcar varios permisos seguidos sin bloquear la lista.
    setPermModal(p => {
      if (!p) return p
      const updated = { ...(p.permissions ?? {}), [key]: !(p.permissions?.[key]) }
      setSavingPerms(true)
      adminSetPermissions(p.id, updated)
        .then(() => loadUsers())
        .catch(() => alert('Error al guardar permisos'))
        .finally(() => setSavingPerms(false))
      return { ...p, permissions: updated }
    })
  }

  return (
    <div className="adm-users">
      <div className="adm-users__header">
        <span>Usuarios del sistema</span>
        <span className="adm-users__count">{users.length} usuario{users.length !== 1 ? 's' : ''}</span>
      </div>

      {loadingU ? (
        <p className="adm-users__loading">Cargando…</p>
      ) : (
        <div className="adm-users__list">
          {users.map(u => (
            <div key={u.id} className={`adm-user-row ${u.username === currentUser ? 'adm-user-row--me' : ''}`}>
              <span className="adm-user-row__icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </span>
              <span className="adm-user-row__name">
                {u.username}
                {u.username === currentUser && <span className="adm-user-row__you">tú</span>}
                <span className={`adm-role-badge adm-role-badge--${u.role || 'editor'}`}>
                  {u.role === 'admin' ? 'Admin' : u.role === 'staff' ? 'Staff App' : 'Editor'}
                </span>
              </span>
              <span className="adm-user-row__date">
                {String(u.created_at ?? '').slice(0, 10)}
              </span>
              {userRole === 'admin' && u.role !== 'admin' && (
                <button className="adm-user-row__btn" title="Permisos"
                  onClick={() => setPermModal({ ...u })}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </button>
              )}
              <button className="adm-user-row__btn" title="Cambiar contraseña"
                onClick={() => setChangePwd({ open: true, user: u.username, val: '', show: false })}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </button>
              <button className="adm-user-row__btn adm-user-row__btn--del" title="Eliminar"
                onClick={() => del(u.id, u.username, u.role)} disabled={u.username === currentUser}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Change password modal */}
      {changePwd.open && (
        <form onSubmit={saveChange} className="adm-users__change">
          <span className="adm-users__change-title">Nueva contraseña para <strong>{changePwd.user}</strong></span>
          <div className="adm-pw" style={{ flex: 1 }}>
            <input
              type={changePwd.show ? 'text' : 'password'}
              value={changePwd.val}
              onChange={e => setChangePwd(p => ({ ...p, val: e.target.value }))}
              placeholder="Nueva contraseña"
              className="adm-pw__input"
            />
            <button type="button" className="adm-pw__eye" onClick={() => setChangePwd(p => ({ ...p, show: !p.show }))}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={creating}>Guardar</button>
          <button type="button" className="adm-btn-sm" onClick={() => setChangePwd({ open: false, user: '', val: '', show: false })}>Cancelar</button>
        </form>
      )}

      {/* Permissions modal */}
      {permModal && (
        <div className="adm-evt-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setPermModal(null)}>
          <div className="adm-evt-modal">
            <div className="adm-evt-modal__head">
              <span className="adm-users__change-title" style={{ margin: 0 }}>
                Permisos — <strong>{permModal.username}</strong>
              </span>
              <button className="adm-evt-modal__close" onClick={() => setPermModal(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="adm-perms__hint">Activa las secciones a las que este usuario puede acceder.</p>
            <div className="adm-perms__list">
              {PERMS_CONFIG.map(({ key, label }) => {
                const active = !!permModal.permissions?.[key]
                return (
                  <button key={key} type="button"
                    className={`adm-perms__row${active ? ' adm-perms__row--on' : ''}`}
                    onClick={() => togglePerm(key)}>
                    <span className="adm-perms__label">{label}</span>
                    <span className={`adm-toggle${active ? ' adm-toggle--on' : ''}`}>
                      <span className="adm-toggle__knob"/>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add user */}
      {userRole === 'admin' && (
        <form onSubmit={create} className="adm-users__add" style={{ flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <input
              type="text"
              value={newUser}
              onChange={e => { setNewUser(e.target.value); setErrU('') }}
              placeholder="Nuevo usuario"
              className="adm-users__input"
              style={{ flex: 1 }}
            />
            <div className="adm-pw" style={{ flex: 1 }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={e => { setNewPwd(e.target.value); setErrU('') }}
                placeholder="Contraseña"
                className="adm-pw__input"
              />
              <button type="button" className="adm-pw__eye" onClick={() => setShowNew(s => !s)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
            <select 
              value={newRole} 
              onChange={e => setNewRole(e.target.value)}
              className="adm-users__input"
              style={{ flex: 1 }}
            >
              <option value="editor">Rol: Editor (Web)</option>
              <option value="staff">Rol: Staff (App Móvil)</option>
              <option value="admin">Rol: Administrador Total</option>
            </select>
            <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={creating} style={{ padding: '0 24px' }}>
              {creating ? '…' : '+ Crear Usuario'}
            </button>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={newMustChange} onChange={e => setNewMustChange(e.target.checked)} />
            Clave genérica: pedir nueva contraseña en el primer ingreso
          </label>
        </form>
      )}
      {errU && <p className="adm-users__err">{errU}</p>}
    </div>
  )
}

const DIAS_REC = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábados','Domingos']

const FREC_REC = [
  { val: 'todas', label: 'Cada semana' },
  { val: 'sem13', label: 'Sem. 1 y 3'  },
  { val: 'sem24', label: 'Sem. 2 y 4'  },
]

const FREC_LABEL = { todas: '', sem13: ' · sem. 1 y 3', sem24: ' · sem. 2 y 4' }

function buildFecha(dia, frec) {
  // for weekly store "Todos los viernes"; for alternating just the day name
  return frec === 'todas' ? `Todos los ${dia.toLowerCase()}` : dia
}

function recoverRec(a) {
  const m = (a.fecha ?? '').match(/^Todos los (.+)$/)
  const raw = m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : (a.fecha ?? 'Viernes')
  const diaRec = DIAS_REC.find(d => d.toLowerCase() === raw.toLowerCase()) ?? 'Viernes'
  return { diaRec, frecRec: a.semanas ?? 'todas' }
}

function actSlug(name, id) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + id
}

// ── Activities section ────────────────────────────────────
// Sección combinada: Actividades + Eventos bajo un solo tab con sub-toggle.
function ContenidoSection({ canSee, initial = 'actividades' }) {
  const canA = canSee('actividades')
  const canE = canSee('eventos')
  const [sub, setSub] = useState(initial)
  const view = (sub === 'eventos' && canE) ? 'eventos' : (canA ? 'actividades' : 'eventos')
  return (
    <div className="adm-contenido">
      <div className="adm-contenido__bar">
        <div className="adm-seg-group">
          {canA && (
            <button className={`adm-seg ${view === 'actividades' ? 'adm-seg--on' : ''}`} onClick={() => setSub('actividades')}>
              Actividades
            </button>
          )}
          {canE && (
            <button className={`adm-seg ${view === 'eventos' ? 'adm-seg--on' : ''}`} onClick={() => setSub('eventos')}>
              Eventos
            </button>
          )}
        </div>
      </div>
      {view === 'actividades' ? <ActivitiesSection /> : <EventosSection />}
    </div>
  )
}

function ActivitiesSection() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')
  const [createdModal, setCreatedModal] = useState(null)
  const [linkCopied, setLinkCopied]    = useState(false)
  const [showCreate, setShowCreate]    = useState(false)

  // New activity form state
  const [newAct, setNewAct] = useState({
    name: '', fechaTipo: 'rec', fecha: '', diaRec: 'Viernes', frecRec: 'todas', hora: '',
    price: '', capacity: '', evtDate: '', description: '', showEvt: false,
  })

  // Event info per activity
  const [eventInfo, setEventInfo] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setActivities(await getActivities())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    activities.forEach(async (a) => {
      const numId = parseInt(a.id)
      if (isNaN(numId)) return
      const ev = await getEventByActivityId(numId)
      setEventInfo(prev => ({
        ...prev,
        [a.id]: {
          price: ev?.price ?? '',
          description: ev?.description ?? '',
          date: ev?.date ?? '',
          capacity: ev?.capacity ? String(ev.capacity) : '',
          hasEvent: !!ev,
        }
      }))
    })
  }, [activities])

  const startEdit = (a) => {
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(a.fecha ?? '')
    const tipo = isDate || !a.fecha ? 'fecha' : 'rec'
    const { diaRec: dr, frecRec: fr } = recoverRec(a)
    const ev = eventInfo[a.id] ?? {}
    setEditItem({
      id: a.id, name: a.name, tipo,
      fecha: isDate ? (a.fecha ?? '') : '',
      diaRec: dr, frecRec: fr, hora: a.hora ?? '',
      price: ev.price ?? '', description: ev.description ?? '',
      evtDate: ev.date ?? '', capacity: ev.capacity ?? '',
    })
    setErr('')
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editItem.name.trim()) return
    const fechaValue = editItem.tipo === 'fecha' ? editItem.fecha : buildFecha(editItem.diaRec, editItem.frecRec)
    const semanasValue = editItem.tipo === 'rec' ? editItem.frecRec : 'todas'
    setSaving(true); setErr('')
    try {
      await updateActivity(editItem.id, editItem.name.trim(), fechaValue, editItem.hora, semanasValue)
      const hasEvtData = editItem.price || editItem.description || editItem.capacity || editItem.evtDate || eventInfo[editItem.id]?.hasEvent
      if (hasEvtData) {
        await upsertActivityEvent(
          editItem.id, editItem.name.trim(),
          parseFloat(editItem.price) || 0,
          editItem.description.trim(),
          editItem.tipo === 'fecha' ? editItem.fecha : editItem.evtDate,
          parseInt(editItem.capacity) || 0,
        )
      }
      setEditItem(null); load()
    } catch { setErr('Error al guardar') }
    finally { setSaving(false) }
  }

  const add = async (e) => {
    e.preventDefault()
    if (!newAct.name.trim()) { setErr('Escribe el nombre de la actividad'); return }
    const fechaValue = newAct.fechaTipo === 'fecha' ? newAct.fecha : buildFecha(newAct.diaRec, newAct.frecRec)
    const semanasValue = newAct.fechaTipo === 'rec' ? newAct.frecRec : 'todas'
    setSaving(true); setErr('')
    try {
      const newId = await saveActivity(newAct.name.trim(), fechaValue, newAct.hora, semanasValue)
      const hasEvt = !!(newAct.price || newAct.capacity || newAct.description || newAct.evtDate)
      if (newId && hasEvt) {
        await upsertActivityEvent(
          newId, newAct.name.trim(),
          parseFloat(newAct.price) || 0,
          newAct.description.trim(),
          newAct.fechaTipo === 'fecha' ? newAct.fecha : newAct.evtDate,
          parseInt(newAct.capacity) || 0,
        )
      }
      const slug = newId ? actSlug(newAct.name.trim(), newId) : null
      setShowCreate(false)
      setCreatedModal({ name: newAct.name.trim(), slug, hasEvt: !!(newId && hasEvt) })
      setNewAct({ name: '', fechaTipo: 'rec', fecha: '', diaRec: 'Viernes', frecRec: 'todas', hora: '', price: '', capacity: '', evtDate: '', description: '', showEvt: false })
      load()
    } catch { setErr('Error al guardar') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('¿Eliminar esta actividad?')) return
    await deleteActivity(id); load()
  }

  const setE = (k) => (e) => setEditItem(p => ({ ...p, [k]: e.target.value }))
  const setN = (k) => (v) => setNewAct(p => ({ ...p, [k]: typeof v === 'object' ? v.target.value : v }))

  const EventFieldsDivider = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 2px' }}>
      <div style={{ flex: 1, height: 1, background: '#e5e8d8' }}/>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#7a8c2e', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        Evento vinculado
      </span>
      <div style={{ flex: 1, height: 1, background: '#e5e8d8' }}/>
    </div>
  )

  return (
    <div className="adm-activities">
      <div className="adm-users__header">
        <span>Actividades</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <span className="adm-users__count">{activities.length} activa{activities.length !== 1 ? 's' : ''}</span>
          <button className="adm-btn-sm adm-btn-sm--green" onClick={() => { setShowCreate(true); setErr('') }}>+ Nueva actividad</button>
        </div>
      </div>

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-users__list">
          {activities.length === 0 && (
            <div className="adm-empty-cta">
              <span className="adm-empty-cta__icon">{getActivityIcon('')}</span>
              <p className="adm-empty-cta__txt">Aún no tienes actividades.</p>
              <button className="adm-btn-sm adm-btn-sm--green" onClick={() => { setShowCreate(true); setErr('') }}>+ Crear la primera</button>
            </div>
          )}
          {activities.map(a => {
            const ev = eventInfo[a.id]
            return (
              <div key={a.id} className="adm-act-row">
                <span className="adm-act-row__icon">{getActivityIcon(a.name)}</span>
                <div className="adm-act-row__info">
                  <span className="adm-act-row__name">
                    {a.name}
                    {a.semanas && a.semanas !== 'todas' && (
                      <span className="adm-act-badge">{FREC_LABEL[a.semanas]?.trim()}</span>
                    )}
                    {ev?.hasEvent && (
                      <span className="adm-act-badge adm-act-badge--evt">
                        {ev.price > 0 ? `$${parseFloat(ev.price).toFixed(0)}` : ''}
                        {ev.price > 0 && ev.capacity > 0 ? ' · ' : ''}
                        {ev.capacity > 0 ? `${ev.capacity} lugares` : ''}
                        {!ev.price && !ev.capacity ? 'Con evento' : ''}
                      </span>
                    )}
                  </span>
                  {(a.fecha || a.hora) && (
                    <span className="adm-act-row__when">
                      {fmtFecha(a.fecha)}{a.hora ? ' · ' + fmtHora(a.hora) : ''}
                    </span>
                  )}
                  {ev?.description && (
                    <span className="adm-act-row__when" style={{ color: '#7a8c2e', fontStyle: 'italic' }}>
                      {ev.description}
                    </span>
                  )}
                </div>
                <button className="adm-user-row__btn" onClick={() => startEdit(a)} title="Editar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => del(a.id)} title="Eliminar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Edit modal ── */}
      {editItem && (
        <div className="adm-evt-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setEditItem(null)}>
          <div className="adm-evt-modal">
            <div className="adm-evt-modal__head">
              <span className="adm-users__change-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{getActivityIcon(editItem.name)}</span>
                {editItem.name}
              </span>
              <button className="adm-evt-modal__close" onClick={() => setEditItem(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={saveEdit} className="adm-act-edit">
              <input type="text" value={editItem.name} onChange={setE('name')} placeholder="Nombre" className="adm-users__input adm-act-form__name" />

              <div className="adm-act-tipo">
                <button type="button" className={editItem.tipo === 'fecha' ? 'active' : ''} onClick={() => setEditItem(p => ({...p, tipo: 'fecha', evtDate: ''}))}>Fecha específica</button>
                <button type="button" className={editItem.tipo === 'rec'   ? 'active' : ''} onClick={() => setEditItem(p => ({...p, tipo: 'rec',   fecha: ''}))}>Recurrente</button>
              </div>
              {editItem.tipo === 'fecha' ? (
                <input type="date" value={editItem.fecha || ''} onChange={setE('fecha')} className="adm-users__input" aria-label="Fecha específica" />
              ) : (
                <div className="adm-act-rec-fields">
                  <div className="adm-act-rec-wrap">
                    <select value={editItem.diaRec} onChange={setE('diaRec')} className="adm-users__input">
                      {DIAS_REC.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={editItem.frecRec} onChange={setE('frecRec')} className="adm-users__input">
                      {FREC_REC.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
                    </select>
                  </div>
                  <input type="date" value={editItem.evtDate || ''} onChange={setE('evtDate')} className="adm-users__input" aria-label="Próxima fecha" />
                </div>
              )}
              <input type="time" value={editItem.hora || ''} onChange={setE('hora')} className="adm-users__input" aria-label="Hora" />

              <EventFieldsDivider />
              <div className="adm-act-evt-grid">
                <input type="number" step="0.01" min="0" value={editItem.price} onChange={setE('price')} placeholder="Precio ($)" className="adm-users__input" />
                <input type="number" min="0" value={editItem.capacity} onChange={setE('capacity')} placeholder="Lugares (capacidad)" className="adm-users__input" />
              </div>
              <DescField
                value={editItem.description}
                onChange={setE('description')}
                name={editItem.name}
                price={editItem.price}
                date={editItem.tipo === 'fecha' ? editItem.fecha : editItem.evtDate}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving} style={{ flex: 1 }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                <button type="button" className="adm-btn-sm" onClick={() => setEditItem(null)}>Cancelar</button>
              </div>
              {err && <p className="adm-users__err">{err}</p>}
            </form>
          </div>
        </div>
      )}

      {/* ── Add form (modal) ── */}
      {showCreate && (
       <div className="adm-evt-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setShowCreate(false)}>
        <div className="adm-evt-modal">
          <div className="adm-evt-modal__head">
            <span className="adm-users__change-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{getActivityIcon(newAct.name)}</span>
              Nueva actividad
            </span>
            <button className="adm-evt-modal__close" onClick={() => setShowCreate(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
      <form onSubmit={add} className="adm-act-edit">
        <input type="text" value={newAct.name}
          onChange={e => { setN('name')(e); setErr('') }}
          placeholder="Nombre de la actividad (ej: Yoga, Pilates…)"
          className="adm-users__input adm-act-form__name" />

        <div className="adm-act-tipo">
          <button type="button" className={newAct.fechaTipo === 'fecha' ? 'active' : ''} onClick={() => setNewAct(p => ({...p, fechaTipo: 'fecha', evtDate: ''}))}>Fecha específica</button>
          <button type="button" className={newAct.fechaTipo === 'rec'   ? 'active' : ''} onClick={() => setNewAct(p => ({...p, fechaTipo: 'rec',   fecha:   ''}))}>Recurrente</button>
        </div>
        {newAct.fechaTipo === 'fecha' ? (
          <input type="date" value={newAct.fecha || ''} onChange={e => setN('fecha')(e.target.value)} className="adm-users__input" aria-label="Fecha específica" />
        ) : (
          <div className="adm-act-rec-fields">
            <div className="adm-act-rec-wrap">
              <select value={newAct.diaRec} onChange={setN('diaRec')} className="adm-users__input">
                {DIAS_REC.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={newAct.frecRec} onChange={setN('frecRec')} className="adm-users__input">
                {FREC_REC.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
              </select>
            </div>
            <input type="date" value={newAct.evtDate || ''} onChange={e => setN('evtDate')(e.target.value)} className="adm-users__input" aria-label="Próxima fecha" />
          </div>
        )}
        <input type="time" value={newAct.hora || ''} onChange={e => setN('hora')(e.target.value)} className="adm-users__input" aria-label="Hora" />

        <button type="button"
          className="adm-act-toggle-evt"
          onClick={() => setN('showEvt')(!newAct.showEvt)}>
          {newAct.showEvt ? '▾ Ocultar detalles del evento' : '▸ Agregar precio / capacidad / fecha de evento'}
        </button>

        {newAct.showEvt && (
          <>
            <EventFieldsDivider />
            <div className="adm-act-evt-grid">
              <input type="number" step="0.01" min="0" value={newAct.price} onChange={setN('price')} placeholder="Precio ($)" className="adm-users__input" />
              <input type="number" min="0" value={newAct.capacity} onChange={setN('capacity')} placeholder="Lugares" className="adm-users__input" />
            </div>
            <DescField
              value={newAct.description}
              onChange={setN('description')}
              name={newAct.name}
              price={newAct.price}
              date={newAct.fechaTipo === 'fecha' ? newAct.fecha : newAct.evtDate}
            />
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Guardando…' : '+ Crear actividad'}
          </button>
          <button type="button" className="adm-btn-sm" onClick={() => setShowCreate(false)}>Cancelar</button>
        </div>
        {err && <p className="adm-users__err">{err}</p>}
      </form>
        </div>
       </div>
      )}

      {/* ── Created modal ── */}
      {createdModal && (
        <div className="adm-evt-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setCreatedModal(null)}>
          <div className="adm-evt-modal adm-created-modal">
            <button className="adm-evt-modal__close" style={{ alignSelf: 'flex-end' }} onClick={() => { setCreatedModal(null); setLinkCopied(false) }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="adm-created-modal__check">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="adm-created-modal__title">¡{createdModal.name} creada!</h3>
            {createdModal.hasEvt ? (
              <>
                <p className="adm-created-modal__sub">Comparte el enlace de inscripción con tus clientes.</p>
                <div className="adm-created-modal__actions">
                  <button
                    className={`adm-created-modal__copy${linkCopied ? ' adm-created-modal__copy--ok' : ''}`}
                    onClick={() => {
                      const link = `${window.location.origin}/evento/${createdModal.slug}`
                      if (navigator.clipboard) { navigator.clipboard.writeText(link) }
                      else { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
                      setLinkCopied(true)
                      setTimeout(() => setLinkCopied(false), 2200)
                    }}>
                    {linkCopied
                      ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> ¡Copiado!</>
                      : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copiar enlace</>
                    }
                  </button>
                  <button
                    className="adm-created-modal__wa"
                    onClick={() => {
                      const link = `${window.location.origin}/evento/${createdModal.slug}`
                      const msg = `¡Apúntate a *${createdModal.name}*! Regístrate aquí: ${link}`
                      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.874L0 24l6.294-1.51A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 0 1-5.002-1.368l-.36-.214-3.733.895.944-3.624-.234-.373A9.808 9.808 0 0 1 2.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
                    Compartir por WhatsApp
                  </button>
                </div>
              </>
            ) : (
              <p className="adm-created-modal__sub">La actividad se agregó a la lista.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hotel Reservations view ──────────────────────────────
function HotelReservationsSection({ dateFrom = '', dateTo = '', isAdmin = false }) {
  const [data, setData]               = useState([])
  const [loading, setLoading]         = useState(false)
  const [view, setView]               = useState('confirmed')
  const [sortDir, setSortDir]         = useState('desc')
  const [selected, setSelected]       = useState(new Set())
  const [deleting, setDeleting]       = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await getHotelReservationEvents()
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data.filter(r => {
    if (view === 'confirmed' && r.event_type !== 'reserva_confirmada') return false
    if (view === 'intents'   && r.event_type !== 'reserva_click')      return false
    if (dateFrom || dateTo) {
      const d = r.created_at ? r.created_at.slice(0, 10) : ''
      if (dateFrom && d < dateFrom) return false
      if (dateTo   && d > dateTo)   return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const va = a.created_at ?? '', vb = b.created_at ?? ''
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const toggleSelect  = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll     = () => selected.size === sorted.length ? setSelected(new Set()) : setSelected(new Set(sorted.map(r => r.id)))

  const handleDelete = (id) => {
    if (!isAdmin) return
    setConfirmModal({
      title: 'Eliminar reserva',
      message: '¿Eliminar este registro? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setDeleting(true)
        try { await deleteBotEvent(id); setSelected(prev => { const n = new Set(prev); n.delete(id); return n }); load() }
        catch { /* silent */ }
        finally { setDeleting(false); setConfirmModal(null) }
      },
    })
  }

  const handleDeleteSelected = () => {
    if (!isAdmin) return
    if (selected.size === 0) return
    const ids = [...selected]
    setConfirmModal({
      title: `Eliminar ${selected.size} reserva${selected.size > 1 ? 's' : ''}`,
      message: `Se eliminarán ${selected.size} registro(s) seleccionado(s). Esta acción no se puede deshacer.`,
      confirmLabel: `Eliminar ${selected.size}`,
      onConfirm: async () => {
        setDeleting(true)
        try { for (const id of ids) await deleteBotEvent(id); setSelected(new Set()); load() }
        catch { /* silent */ }
        finally { setDeleting(false); setConfirmModal(null) }
      },
    })
  }

  const handleClearAll = () => {
    if (!isAdmin) return
    if (sorted.length === 0) return
    setConfirmModal({
      title: 'Vaciar reservas',
      message: `Se eliminarán ${sorted.length} registro(s) visibles. Esta acción no se puede deshacer.`,
      confirmLabel: `Vaciar ${sorted.length}`,
      onConfirm: async () => {
        setDeleting(true)
        try { for (const r of sorted) await deleteBotEvent(r.id); setSelected(new Set()); load() }
        catch { /* silent */ }
        finally { setDeleting(false); setConfirmModal(null) }
      },
    })
  }

  return (
    <div className="adm-activities">
      <div className="adm-users__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Reservas Hotel</span>
          <div className="adm-ins-toggle">
            <button className={view === 'confirmed' ? 'active' : ''} onClick={() => { setView('confirmed'); setSelected(new Set()) }}>Confirmadas</button>
            <button className={view === 'intents'   ? 'active' : ''} onClick={() => { setView('intents');   setSelected(new Set()) }}>Intentos</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {isAdmin && selected.size > 0 && (
            <button className="adm-btn-sm adm-btn-sm--red" onClick={handleDeleteSelected} disabled={deleting}>
              Eliminar {selected.size} sel.
            </button>
          )}
          {isAdmin && sorted.length > 0 && (
            <button className="adm-btn-sm adm-btn-sm--red-outline" onClick={handleClearAll} disabled={deleting}>
              Vaciar todo
            </button>
          )}
          <span className="adm-users__count">
            {sorted.length}{data.length > 0 ? ` de ${data.filter(r => r.event_type === (view === 'confirmed' ? 'reserva_confirmada' : 'reserva_click')).length}` : ''}
          </span>
        </div>
      </div>

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-registrations-table">
          {sorted.length === 0 ? (
            <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin datos aún</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 32, textAlign: 'center' }}>
                    <input type="checkbox" className="adm-chk"
                      checked={sorted.length > 0 && selected.size === sorted.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Origen</th>
                  <th>Folio</th>
                  <th>Habitación</th>
                  {view === 'confirmed' && <th>Noches</th>}
                  <th onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} style={{ cursor: 'pointer' }}>
                    Fecha {sortDir === 'asc' ? '↑' : '↓'}
                  </th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id} className={selected.has(r.id) ? 'adm-tr--selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" className="adm-chk" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                    </td>
                    <td><span className="adm-how-badge">{RESERVA_LABELS[r.source] ?? r.source ?? '—'}</span></td>
                    <td>
                      {r.folio ? <span className="adm-folio">{r.folio}</span> : <span style={{ color: '#c5c9b8' }}>—</span>}
                      {r.origin === 'web' && <span className="adm-origin-badge">web</span>}
                    </td>
                    <td><strong style={{ textTransform: 'capitalize' }}>{r.room ?? '—'}</strong></td>
                    {view === 'confirmed' && <td>{r.nights ?? '—'}</td>}
                    <td className="adm-table__date">{fmtDBDate(r.created_at)}</td>
                    <td>
                      {isAdmin && (
                        <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => handleDelete(r.id)} title="Eliminar">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          loading={deleting}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => { if (!deleting) setConfirmModal(null) }}
        />
      )}
    </div>
  )
}

// ── Confirm Modal ────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Eliminar', loading = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, loading])

  return (
    <div className="adm-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel() }}>
      <div className="adm-confirm-card">
        <div className="adm-confirm-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </div>
        <h3 className="adm-confirm-title">{title}</h3>
        <p className="adm-confirm-msg">{message}</p>
        <div className="adm-confirm-actions">
          <button className="adm-confirm-cancel" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="adm-confirm-ok" onClick={onConfirm} disabled={loading}>
            {loading ? 'Eliminando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Activity Registrations view ──────────────────────────
function ReportesSection() {
  const [mode, setMode]         = useState('1m')   // '7d' | '1m' | '3m' | 'mes' | 'semana'
  const [monthSel, setMonthSel] = useState(() => monthOptions(1)[0].value)
  const [weekSel, setWeekSel]   = useState(() => weekOptions(1)[0].value)
  const [rows, setRows]         = useState([])
  const [regs, setRegs]         = useState([])
  const [loading, setLoading]   = useState(false)
  const [exporting, setExporting] = useState(false)
  const [err, setErr]           = useState('')
  const [web, setWeb]           = useState(null)   // tráfico web (Google Search Console)

  const months = monthOptions(12)
  const weeks  = weekOptions(12)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, reg] = await Promise.all([getHotelReservationEvents(), getAllActivityRegistrations()])
      setRows(res || []); setRegs(reg || [])
    } catch { setRows([]); setRegs([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const range =
      mode === 'mes'    ? monthRange(monthSel)
    : mode === 'semana' ? weekRange(weekSel)
    : presetRange(mode)
  const modeLabel = mode === 'mes' ? 'Mes' : mode === 'semana' ? 'Semana' : 'Período'
  const agg = aggregateReservas(rows, range.from, range.to)
  const ins = aggregateInscripciones(regs, range.from, range.to)
  const bk  = bucketReservas(rows, range.from, range.to)

  // Tráfico web del periodo (Google Search Console: impresiones, clics, CTR, posición)
  useEffect(() => {
    let cancel = false
    setWeb(null)
    const url = `${API_BASE}/.netlify/functions/gsc?from=${range.from}&to=${range.to}`
    fetch(url)
      .then(r => r.json())
      .then(j => {
        if (cancel) return
        if (j && j.totals && !j.error) {
          const t = j.totals
          const fmtN = n => Number(n || 0).toLocaleString('es-MX')
          setWeb({ ok: true, impresiones: fmtN(t.impressions), clics: fmtN(t.clicks), ctr: ((t.ctr || 0) * 100).toFixed(1) + '%', pos: (t.position || 0).toFixed(1) })
        } else {
          setWeb({ ok: false, error: j?.error || 'sin datos' })
        }
      })
      .catch(() => { if (!cancel) setWeb({ ok: false, error: 'error' }) })
    return () => { cancel = true }
  }, [range.from, range.to])

  const handleExport = async () => {
    setExporting(true); setErr('')
    try {
      const html = buildHotelReportHTML({ periodLabel: range.label, modeLabel, agg, ins, bk, web })
      const fname = `reporte-general-${range.from}_${range.to}.pdf`
      const res = await fetch(`${API_BASE}/.netlify/functions/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, filename: fname, landscape: true, preferCSSPageSize: true }),
      })
      if (!res.ok) throw new Error('Error generando PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fname; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setErr(e.message || 'No se pudo exportar') }
    finally { setExporting(false) }
  }

  const presetBtn = (key, label) => (
    <button className={mode === key ? 'active' : ''} onClick={() => setMode(key)}>{label}</button>
  )

  return (
    <div className="adm-activities">
      <div className="adm-users__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>Reporte General</span>
          <div className="adm-ins-toggle">
            {presetBtn('7d', '7 días')}
            {presetBtn('1m', '1 mes')}
            {presetBtn('3m', '3 meses')}
          </div>
          <select className={`adm-select${mode === 'mes' ? ' adm-select--on' : ''}`} value={mode === 'mes' ? monthSel : ''}
            onChange={e => { setMonthSel(e.target.value); setMode('mes') }}>
            <option value="" disabled>Mes…</option>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select className={`adm-select${mode === 'semana' ? ' adm-select--on' : ''}`} value={mode === 'semana' ? weekSel : ''}
            onChange={e => { setWeekSel(e.target.value); setMode('semana') }}>
            <option value="" disabled>Semana…</option>
            {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button className="adm-btn-sm adm-btn-sm--primary" onClick={handleExport} disabled={exporting || loading}>
            {exporting ? 'Generando…' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {err && <p style={{ color: '#c0392b', padding: '8px 4px', fontSize: 13 }}>{err}</p>}

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-rep-empty">
          <div className="adm-rep-empty__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/>
            </svg>
          </div>
          <h3 className="adm-rep-empty__title">Reporte listo para exportar</h3>
          <p className="adm-rep-empty__sub">Período: <strong style={{ textTransform: 'capitalize' }}>{range.label}</strong></p>
          <p className="adm-rep-empty__txt">
            El PDF incluye: visitas e impresiones web (Google), reservas confirmadas e intentos,
            conversión, noches, distribución por habitación y origen, e inscripciones por evento.
          </p>
          <button className="adm-btn-sm adm-btn-sm--primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Generando…' : 'Exportar PDF'}
          </button>
          {web && !web.ok && (
            <p className="adm-rep-empty__warn">Tráfico web no disponible ({web.error}). El resto del reporte sí se genera.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ActivityRegistrationsSection({ dateFrom = '', dateTo = '', isAdmin = false }) {
  const [regs, setRegs]           = useState([])
  const [intents, setIntents]     = useState([])
  const [payingId, setPayingId]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [view, setView]           = useState('confirmed') // 'confirmed' | 'intents'
  const [evtFilter, setEvtFilter] = useState('')
  const [howFilter, setHowFilter] = useState('')
  const [sortKey, setSortKey]     = useState('date')
  const [sortDir, setSortDir]     = useState('desc')
  const [selected, setSelected]   = useState(new Set())
  const [deleting, setDeleting]   = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)

  // Auto-filter by ID if search param exists
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const searchId = params.get('regId')
    if (searchId && view === 'confirmed') {
      setEvtFilter('') // Clear other filters
      setHowFilter('')
      // We don't have a direct "id" filter in the UI but we can use it to highlight or filter
    }
  }, [view])

  const loadData = useCallback(async () => {
    setLoading(true)
    if (view === 'confirmed') {
      const d = await getAllActivityRegistrations()
      setRegs(d)
    } else {
      const d = await getActivityRegistrationIntents()
      setIntents(d)
    }
    setLoading(false)
  }, [view])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = (id, name) => {
    if (!isAdmin) return
    setConfirmModal({
      title: 'Eliminar registro',
      message: `¿Eliminar el registro de ${name}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setDeleting(true)
        try {
          if (view === 'confirmed') await deleteActivityRegistration(id)
          else await deleteBotEvent(id)
          setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
          loadData()
        } catch { /* silent */ }
        finally { setDeleting(false); setConfirmModal(null) }
      },
    })
  }

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const handleDeleteSelected = () => {
    if (!isAdmin) return
    if (selected.size === 0) return
    const ids = [...selected]
    setConfirmModal({
      title: `Eliminar ${selected.size} registro${selected.size > 1 ? 's' : ''}`,
      message: `Se eliminarán ${selected.size} registro(s) seleccionado(s). Esta acción no se puede deshacer.`,
      confirmLabel: `Eliminar ${selected.size}`,
      onConfirm: async () => {
        setDeleting(true)
        try {
          for (const id of ids) {
            if (view === 'confirmed') await deleteActivityRegistration(id)
            else await deleteBotEvent(id)
          }
          setSelected(new Set())
          loadData()
        } catch { /* silent */ }
        finally { setDeleting(false); setConfirmModal(null) }
      },
    })
  }

  const handleClearAll = () => {
    if (!isAdmin) return
    const target = sorted
    if (target.length === 0) return
    setConfirmModal({
      title: 'Vaciar registros',
      message: `Se eliminarán ${target.length} registro(s) visibles${hasFilters ? ' (filtrados)' : ''}. Esta acción no se puede deshacer.`,
      confirmLabel: `Vaciar ${target.length}`,
      onConfirm: async () => {
        setDeleting(true)
        try {
          for (const r of target) {
            if (view === 'confirmed') await deleteActivityRegistration(r.id)
            else await deleteBotEvent(r.id)
          }
          setSelected(new Set())
          loadData()
        } catch { /* silent */ }
        finally { setDeleting(false); setConfirmModal(null) }
      },
    })
  }

  const handleTogglePaid = async (id, currentPaid) => {
    if (payingId) return
    const next = !currentPaid
    setPayingId(id)
    // Actualización optimista: feedback inmediato y evita el doble-clic que cancelaba el cambio
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    setRegs(rs => rs.map(r => r.id === id ? { ...r, paid: next ? 1 : 0, paid_at: next ? nowIso : null } : r))
    try {
      await updateActivityRegistrationPayment(id, next)
    } catch {
      setRegs(rs => rs.map(r => r.id === id ? { ...r, paid: currentPaid ? 1 : 0 } : r))
      alert('Error al actualizar pago')
    } finally {
      setPayingId(null)
    }
  }

  // Reinicia a 0 TODAS las inscripciones a eventos (confirmadas + intentos: zumba, yoga, etc.)
  const handleResetAll = () => {
    if (!isAdmin) return
    setConfirmModal({
      title: 'Reiniciar inscripciones a 0',
      message: 'Se eliminarán TODAS las inscripciones a eventos/actividades (confirmadas e intentos: zumba, yoga, etc.) y sus contadores quedarán en 0. No afecta reservas de hotel. Esta acción no se puede deshacer.',
      confirmLabel: 'Reiniciar a 0',
      onConfirm: async () => {
        setDeleting(true)
        try { await clearActivityInscriptions(); setSelected(new Set()); loadData() }
        catch { /* silent */ }
        finally { setDeleting(false); setConfirmModal(null) }
      },
    })
  }

  const currentData = view === 'confirmed' ? regs : intents
  const getLabel = (r) => r.event_name?.trim() || r.activity_name?.trim() || 'Sin evento'

  const evtCounts = currentData.reduce((acc, r) => { const k = getLabel(r); acc[k] = (acc[k] || 0) + 1; return acc }, {})
  const howCounts = currentData.reduce((acc, r) => { const k = r.how_found || '—'; acc[k] = (acc[k] || 0) + 1; return acc }, {})

  const evtLabels = Object.keys(evtCounts).sort()
  const howLabels = Object.keys(howCounts).sort()

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortIcon = (key) => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓'

  const afterFilters = currentData.filter(r => {
    const params = new URLSearchParams(window.location.search)
    const searchId = params.get('regId')
    if (searchId && String(r.id) !== searchId) return false

    if (evtFilter && getLabel(r) !== evtFilter) return false
    if (howFilter && (r.how_found || '—') !== howFilter) return false
    if (dateFrom || dateTo) {
      const d = r.created_at ? r.created_at.slice(0, 10) : ''
      if (dateFrom && d < dateFrom) return false
      if (dateTo   && d > dateTo)   return false
    }
    return true
  })

  const clearSearch = () => {
    const url = new URL(window.location)
    url.searchParams.delete('regId')
    window.history.replaceState({}, '', url)
    loadData()
  }

  const sorted = [...afterFilters].sort((a, b) => {
    let va, vb
    if (sortKey === 'event')     { va = getLabel(a);        vb = getLabel(b) }
    else if (sortKey === 'name') { va = a.full_name ?? '';  vb = b.full_name ?? '' }
    else if (sortKey === 'how')  { va = a.how_found ?? '';  vb = b.how_found ?? '' }
    else                         { va = a.created_at ?? ''; vb = b.created_at ?? '' }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const hasFilters = evtFilter || howFilter || dateFrom || dateTo

  return (
    <div className="adm-activities">
      <div className="adm-users__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Inscripciones</span>
          <div className="adm-ins-toggle">
            <button className={view === 'confirmed' ? 'active' : ''} onClick={() => { setView('confirmed'); setEvtFilter(''); setHowFilter(''); setSelected(new Set()) }}>Confirmadas</button>
            <button className={view === 'intents' ? 'active' : ''} onClick={() => { setView('intents'); setEvtFilter(''); setHowFilter(''); setSelected(new Set()) }}>Intentos</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {isAdmin && selected.size > 0 && (
            <button className="adm-btn-sm adm-btn-sm--red" onClick={handleDeleteSelected} disabled={deleting}>
              Eliminar {selected.size} sel.
            </button>
          )}
          {isAdmin && sorted.length > 0 && (
            <button className="adm-btn-sm adm-btn-sm--red-outline" onClick={handleClearAll} disabled={deleting}>
              Vaciar vista
            </button>
          )}
          {isAdmin && (regs.length > 0 || intents.length > 0) && (
            <button className="adm-btn-sm adm-btn-sm--red" onClick={handleResetAll} disabled={deleting} title="Borra confirmadas e intentos y deja en 0">
              Reiniciar a 0
            </button>
          )}
          <span className="adm-users__count">
            {sorted.length}{hasFilters ? ` de ${currentData.length}` : ' en total'}
          </span>
        </div>
        {new URLSearchParams(window.location.search).get('regId') && (
          <button className="adm-btn-sm adm-btn-sm--green" onClick={clearSearch} style={{ marginLeft: 12 }}>
            Ver todos
          </button>
        )}
      </div>

      {!loading && evtLabels.length > 0 && (
        <div className="adm-ins-filters">
          <div className="adm-ins-group">
            <p className="adm-ins-group-label">Evento</p>
            <div className="adm-ins-summary">
              {evtLabels.map(label => (
                <button key={label}
                  className={`adm-ins-card ${evtFilter === label ? 'adm-ins-card--active' : ''}`}
                  onClick={() => setEvtFilter(f => f === label ? '' : label)}>
                  <span className="adm-ins-card__count">{evtCounts[label]}</span>
                  <span className="adm-ins-card__label">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="adm-ins-group">
            <p className="adm-ins-group-label">Canal</p>
            <div className="adm-ins-summary">
              {howLabels.map(label => (
                <button key={label}
                  className={`adm-ins-card adm-ins-card--how ${howFilter === label ? 'adm-ins-card--active' : ''}`}
                  onClick={() => setHowFilter(f => f === label ? '' : label)}>
                  <span className="adm-ins-card__count">{howCounts[label]}</span>
                  <span className="adm-ins-card__label">{label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Filtros activos */}
      {hasFilters && (
        <div className="adm-ins-filterbar">
          {evtFilter && <span className="adm-ins-chip">Evento: <strong>{evtFilter}</strong><button onClick={() => setEvtFilter('')}>✕</button></span>}
          {howFilter && <span className="adm-ins-chip adm-ins-chip--how">Canal: <strong>{howFilter}</strong><button onClick={() => setHowFilter('')}>✕</button></span>}
          {(dateFrom || dateTo) && (
            <span className="adm-ins-chip adm-ins-chip--date">
              {dateFrom || '…'} → {dateTo || '…'}
            </span>
          )}
          <button className="adm-ins-clear" onClick={() => { setEvtFilter(''); setHowFilter('') }}>Limpiar filtros</button>
        </div>
      )}

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-registrations-table">
          {sorted.length === 0 ? (
            <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>{view === 'confirmed' ? 'Sin inscripciones con estos filtros' : 'Sin intentos con estos filtros'}</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 32, textAlign: 'center' }}>
                    <input type="checkbox"
                      className="adm-chk"
                      checked={sorted.length > 0 && selected.size === sorted.length}
                      onChange={() => selected.size === sorted.length ? setSelected(new Set()) : setSelected(new Set(sorted.map(r => r.id)))}
                    />
                  </th>
                  <th className="adm-th-sort" onClick={() => toggleSort('event')}>Evento{sortIcon('event')}</th>
                  <th className="adm-th-sort" onClick={() => toggleSort('name')}>Nombre{sortIcon('name')}</th>
                  <th>Teléfono</th>
                  {view === 'confirmed' && <th>Estado Pago</th>}
                  <th className="adm-th-sort" onClick={() => toggleSort('how')}>¿Cómo se enteró?{sortIcon('how')}</th>
                  <th className="adm-th-sort" onClick={() => toggleSort('date')}>Fecha{sortIcon('date')}</th>
                  {view === 'confirmed' && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id} className={selected.has(r.id) ? 'adm-tr--selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" className="adm-chk" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                    </td>
                    <td><strong>{getLabel(r)}</strong></td>
                    <td>{r.full_name}</td>
                    <td>{r.phone}</td>
                    {view === 'confirmed' && (
                      <td>
                        <button
                          className={`adm-pay-toggle ${r.paid ? 'adm-pay-toggle--paid' : ''}`}
                          onClick={() => handleTogglePaid(r.id, !!r.paid)}
                          disabled={payingId === r.id}
                          title={r.paid ? 'Marcar como pendiente' : 'Marcar como pagado'}
                        >
                          {r.paid ? (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> PAGADO</>
                          ) : (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> PENDIENTE</>
                          )}
                        </button>
                        {r.paid_at && <div className="adm-paid-at">{parseDBDate(r.paid_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', timeZone:'America/Mexico_City' })}</div>}
                      </td>
                    )}
                    <td>
                      <span className="adm-how-badge">{r.how_found || '—'}</span>
                    </td>
                    <td className="adm-table__date">
                      {fmtDBDate(r.created_at)}
                    </td>
                    {view === 'confirmed' && (
                      <td>
                        {isAdmin && (
                          <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => handleDelete(r.id, r.full_name)} title="Eliminar">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          loading={deleting}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => { if (!deleting) setConfirmModal(null) }}
        />
      )}
    </div>
  )
}


// ── AI Description Field ─────────────────────────────────
const DESC_MAX = 200

function DescField({ value, onChange, name, price, date }) {
  const [loading, setLoading] = useState(false)
  const remaining = DESC_MAX - (value?.length ?? 0)

  const generate = async () => {
    if (!name?.trim()) { alert('Escribe primero el nombre'); return }
    setLoading(true)
    try {
      const path = '/.netlify/functions/ai-description'
      const url = API_BASE ? `${API_BASE}${path}` : path
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price: parseFloat(price) || 0, date, maxLen: DESC_MAX }),
      })
      const data = await res.json()
      if (data.description) onChange({ target: { value: data.description } })
    } catch { alert('Error al generar') }
    finally { setLoading(false) }
  }

  return (
    <div className="adm-desc-wrap">
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder="Descripción"
        className="adm-users__input"
        maxLength={DESC_MAX}
      />
      <div className="adm-desc-bar">
        <span className={`adm-desc-count ${remaining < 30 ? 'adm-desc-count--warn' : ''}`}>
          {remaining} car.
        </span>
        <button type="button" className="adm-desc-ai" onClick={generate} disabled={loading}>
          {loading
            ? <span className="adm-desc-spin"/>
            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> IA</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser]   = useState('')
  const [pwd, setPwd]     = useState('')
  const [show, setShow]   = useState(false)
  const [err, setErr]     = useState('')
  const [busy, setBusy]   = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!user.trim() || !pwd) return
    setBusy(true); setErr('')
    try {
      const result = await adminLoginSingle(user.trim(), pwd)
      if (result.ok && result.token) {
        onLogin(result.token, result.setup ?? false)
      } else if (result.reason === 'setup') {
        setErr('Modo de configuración: DB vacía pero sin clave de setup válida en el servidor')
        setPwd('')
      } else if (result.error === 'Demasiados intentos. Espera 15 minutos.') {
        setErr(result.error)
      } else {
        setErr('Usuario o contraseña incorrectos')
        setPwd('')
      }
    } catch (err) {
      console.error('Login error:', err)
      setErr(`Error de conexión: ${err.message}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="adm-login">
      <div className="adm-login__accent"/>
      <div className="adm-login__logo-wrap">
        <img src="/logo/icono.svg" alt="Hotel Punta Galería" className="adm-login__logo"/>
      </div>
      <h2 className="adm-login__title">PANEL ADMIN</h2>
      <p className="adm-login__sub">
        <span className="adm-login__line"/>
        HOTEL PUNTA GALERÍA
        <span className="adm-login__line"/>
      </p>
      <form onSubmit={submit} className="adm-login__form">
        <input
          type="text"
          value={user}
          onChange={e => { setUser(e.target.value); setErr('') }}
          placeholder="Usuario"
          className="adm-pw__input"
          autoComplete="username"
        />
        <div className="adm-pw">
          <input
            type={show ? 'text' : 'password'}
            value={pwd}
            onChange={e => { setPwd(e.target.value); setErr('') }}
            placeholder="Contraseña"
            className="adm-pw__input"
            autoComplete="current-password"
          />
          <button type="button" className="adm-pw__eye" onClick={() => setShow(s => !s)} aria-label="Mostrar">
            {show
              ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        </div>
        {err && <p className="adm-pw__err">{err}</p>}
        <button type="submit" className="adm-login__btn" disabled={busy}>
          {busy ? 'Verificando…' : 'Continuar →'}
        </button>
      </form>
      <p className="adm-login__hint">Ctrl + K para abrir / cerrar</p>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────
// ── Slug helper ──────────────────────────────────
function toSlug(name) {
  if (!name || typeof name !== 'string') return ''
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Events section ────────────────────────────────
function EventosSection() {
  const savingRef = useRef(false)
  const [events, setEvents] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [regLoading, setRegLoading] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newEventForm, setNewEventForm] = useState({ name: '', slug: '', price: '', date: '', description: '', capacity: '', activity_id: '', slugManual: false })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [evts, acts] = await Promise.all([getEvents(), getActivities()])
    setEvents(evts)
    setActivities(acts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const viewRegistrations = async (event) => {
    setSelectedEvent(event)
    setRegLoading(true)
    const [r1, r2] = await Promise.all([
      getRegistrationsByEvent(event.id),
      getActivityRegistrationsByEvent(event.id)
    ])
    // Combine and normalize
    const combined = [
      ...r1.map(r => ({ ...r, source: 'event' })),
      ...r2.map(r => ({ ...r, source: 'activity', email: '—', notes: r.how_found || '—' }))
    ].sort((a, b) => parseDBDate(b.created_at) - parseDBDate(a.created_at))
    setRegistrations(combined)
    setRegLoading(false)
  }

  const handleDeleteReg = async (id, name, source) => {
    if (!confirm(`¿Eliminar la inscripción de ${name}?`)) return
    try {
      if (source === 'activity') await deleteActivityRegistration(id)
      else if (source === 'event') await deleteEventRegistration(id)
      viewRegistrations(selectedEvent)
    } catch {
      alert('Error al eliminar')
    }
  }

  const startEdit = (e) => {
    setEditItem({ id: e.id, name: e.name, slug: e.slug, price: e.price ?? '', date: e.date ?? '', description: e.description ?? '', capacity: e.capacity ?? '', activity_id: e.activity_id ?? '' })
    setErr('')
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editItem.name.trim() || !editItem.slug.trim()) return
    setSaving(true); setErr('')
    try {
      await updateEvent(editItem.id, editItem.name.trim(), editItem.slug.trim(), parseFloat(editItem.price) || 0, editItem.description.trim(), editItem.date, parseInt(editItem.capacity) || 0, editItem.activity_id || null)
      setEditItem(null); load()
    } catch { setErr('Error al guardar') }
    finally { setSaving(false) }
  }

  const addEvent = async (e) => {
    e.preventDefault()
    if (savingRef.current) return
    if (!newEventForm.name.trim() || !newEventForm.slug.trim()) { setErr('Nombre y slug son requeridos'); return }
    savingRef.current = true
    setSaving(true); setErr('')
    try {
      await createEvent(newEventForm.name.trim(), newEventForm.slug.trim(), parseFloat(newEventForm.price) || 0, newEventForm.description.trim(), newEventForm.date, parseInt(newEventForm.capacity) || 0, newEventForm.activity_id || null)
      setNewEventForm({ name: '', slug: '', price: '', date: '', description: '', capacity: '', activity_id: '', slugManual: false })
      setShowNewModal(false)
      load()
    } catch (e) { setErr('Error al guardar: ' + e.message) }
    finally { savingRef.current = false; setSaving(false) }
  }

  const delEvent = async (id) => {
    if (!confirm('¿Eliminar este evento?')) return
    await deleteEvent(id); load()
  }

  const copyLink = (id, slug) => {
    const cleanSlug = slug.replace(/-\d+$/, '')
    const link = `${window.location.origin}/evento/${cleanSlug}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link)
    } else {
      const ta = document.createElement('textarea')
      ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2200)
  }

  const shareWhatsApp = (slug, name) => {
    const cleanSlug = slug.replace(/-\d+$/, '')
    const link = `${window.location.origin}/evento/${cleanSlug}`
    const msg = `¡Apúntate a *${name}*! Regístrate aquí: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const set = (k) => (e) => setEditItem(p => ({ ...p, [k]: e.target.value }))
  const setNew = (k) => (e) => {
    const val = e.target.value
    setNewEventForm(p => {
      if (k === 'name' && !p.slugManual) return { ...p, name: val, slug: toSlug(val) }
      if (k === 'slug') return { ...p, slug: val, slugManual: val.length > 0 }
      return { ...p, [k]: val }
    })
  }

  if (selectedEvent) {
    return (
      <div className="adm-eventos">
        <div className="adm-users__header">
          <button className="adm-btn-sm" onClick={() => setSelectedEvent(null)}>← Volver</button>
          <span>{selectedEvent.name} — Inscritos</span>
          <span className="adm-users__count">{registrations.length}</span>
        </div>
        {regLoading ? <p className="adm-users__loading">Cargando…</p> : (
          <div className="adm-registrations-table">
            {registrations.length === 0 ? (
              <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin inscripciones aún</p>
            ) : (
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email / Canal</th>
                    <th>Teléfono</th>
                    <th>Notas</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={`${r.source}-${r.id}`}>
                      <td>{r.full_name}</td>
                      <td>{r.email !== '—' ? r.email : <span className="adm-how-badge">{r.notes}</span>}</td>
                      <td>{r.phone}</td>
                      <td>{r.email !== '—' ? r.notes : '—'}</td>
                      <td>
                        <span className={`adm-pay-badge ${r.source === 'activity' ? 'adm-pay-badge--transfer' : ''}`}>
                          {r.source === 'activity' ? 'Actividad' : 'Evento'}
                        </span>
                      </td>
                      <td className="adm-table__date">{fmtDBDate(r.created_at)}</td>
                      <td>
                        <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => handleDeleteReg(r.id, r.full_name, r.source)} title="Eliminar">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Form shared between modal (new) and inline (edit) ──
  const renderEventForm = (isNew) => (
    <form onSubmit={isNew ? addEvent : saveEdit} className="adm-evt-form-inner">
      <input type="text" value={isNew ? newEventForm.name : editItem.name}
        onChange={isNew ? setNew('name') : set('name')}
        placeholder="Nombre del evento" className="adm-users__input" />
      <input type="text" value={isNew ? newEventForm.slug : editItem.slug}
        onChange={isNew ? setNew('slug') : set('slug')}
        placeholder="Slug (URL automático)" className="adm-users__input" />
      <div className="adm-evt-row2">
        <input type="number" step="0.01" value={isNew ? newEventForm.price : editItem.price}
          onChange={isNew ? setNew('price') : set('price')} placeholder="Precio ($)" className="adm-users__input" />
        <input type="number" value={isNew ? newEventForm.capacity : editItem.capacity}
          onChange={isNew ? setNew('capacity') : set('capacity')} placeholder="Lugares" className="adm-users__input" />
      </div>
      <input type="date"
        value={isNew ? (newEventForm.date || '') : (editItem.date || '')}
        onChange={e => isNew ? setNewEventForm(p => ({...p, date: e.target.value})) : setEditItem(p => ({...p, date: e.target.value}))}
        className="adm-users__input" aria-label="Fecha del evento" />
      <DescField
        value={isNew ? newEventForm.description : editItem.description}
        onChange={isNew ? setNew('description') : set('description')}
        name={isNew ? newEventForm.name : editItem?.name}
        price={isNew ? newEventForm.price : editItem?.price}
        date={isNew ? newEventForm.date : editItem?.date}
      />
      <select value={isNew ? newEventForm.activity_id : (editItem?.activity_id ?? '')}
        onChange={isNew ? setNew('activity_id') : set('activity_id')} className="adm-users__input">
        <option value="">{isNew ? '— Vincular a actividad (opcional) —' : '— Sin vincular a actividad —'}</option>
        {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {err && <p className="adm-err-msg">{err}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="submit" className="adm-btn-sm adm-btn-sm--green" disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Guardando…' : isNew ? 'Crear evento' : 'Guardar cambios'}
        </button>
        <button type="button" className="adm-btn-sm"
          onClick={() => isNew ? (setShowNewModal(false), setErr('')) : setEditItem(null)}>
          Cancelar
        </button>
      </div>
    </form>
  )

  return (
    <div className="adm-eventos">
      {/* Header with "+ Nuevo evento" button */}
      <div className="adm-users__header">
        <span>Eventos</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="adm-users__count">{events.length} evento{events.length !== 1 ? 's' : ''}</span>
          <button className="adm-btn-sm adm-btn-sm--green" onClick={() => { setShowNewModal(true); setErr('') }} style={{ padding: '4px 12px', fontSize: 12 }}>
            + Nuevo evento
          </button>
        </div>
      </div>

      {loading ? <p className="adm-users__loading">Cargando…</p> : (
        <div className="adm-users__list">
          {events.length === 0 && (
            <p className="adm-conv-empty" style={{ padding: '14px 16px' }}>Sin eventos. Crea el primero con "+ Nuevo evento".</p>
          )}
          {events.map(e => {
            const linkedAct = activities.find(a => String(a.id) === String(e.activity_id))
            return (
              <div key={e.id} className="adm-evt-row">
                <div className="adm-evt-row__info">
                  <span className="adm-evt-row__name">
                    {e.name}
                    {linkedAct && (
                      <span className="adm-act-badge adm-act-badge--linked">
                        <span className="adm-badge-icon">{getActivityIcon(linkedAct.name)}</span>
                        {linkedAct.name}
                      </span>
                    )}
                  </span>
                  {e.date && <span className="adm-evt-row__when">{fmtFecha(e.date)}</span>}
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    {e.price > 0 && <span className="adm-act-badge adm-act-badge--evt">${parseFloat(e.price).toFixed(0)}</span>}
                    {e.capacity > 0 && <span className="adm-act-badge" style={{ fontSize: 10 }}>{e.capacity} lugares</span>}
                  </span>
                </div>
                <button className={`adm-user-row__btn${copiedId === e.id ? ' adm-user-row__btn--copied' : ''}`} onClick={() => copyLink(e.id, e.slug)} title="Copiar link">
                  {copiedId === e.id
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  }
                </button>
                <button className="adm-user-row__btn adm-user-row__btn--wa" onClick={() => shareWhatsApp(e.slug, e.name)} title="Compartir por WhatsApp">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.874L0 24l6.294-1.51A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 0 1-5.002-1.368l-.36-.214-3.733.895.944-3.624-.234-.373A9.808 9.808 0 0 1 2.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
                </button>
                <button className="adm-user-row__btn" onClick={() => viewRegistrations(e)} title="Ver inscritos">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </button>
                <button className="adm-user-row__btn" onClick={() => { startEdit(e); setShowNewModal(false) }} title="Editar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="adm-user-row__btn adm-user-row__btn--del" onClick={() => delEvent(e.id)} title="Eliminar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit event modal */}
      {editItem && (
        <div className="adm-evt-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setEditItem(null)}>
          <div className="adm-evt-modal">
            <div className="adm-evt-modal__head">
              <span className="adm-users__change-title" style={{ margin: 0 }}>Editar — {editItem.name}</span>
              <button className="adm-evt-modal__close" onClick={() => setEditItem(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {renderEventForm(false)}
          </div>
        </div>
      )}

      {/* New event modal */}
      {showNewModal && (
        <div className="adm-evt-modal-overlay" onMouseDown={e => e.target === e.currentTarget && (setShowNewModal(false), setErr(''))}>
          <div className="adm-evt-modal">
            <div className="adm-evt-modal__head">
              <span className="adm-users__change-title" style={{ margin: 0 }}>Nuevo evento</span>
              <button className="adm-evt-modal__close" onClick={() => { setShowNewModal(false); setErr('') }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {renderEventForm(true)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Check-in Section ────────────────────────────────────────
function CheckInSection() {
  const [ticketId, setTicketId] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanErr, setScanErr] = useState('')

  const handleLookup = async (e) => {
    e?.preventDefault()
    const id = parseInt(ticketId.trim())
    if (!id) { setScanErr('Ingresa un número de ticket válido'); return }
    setScanning(true); setScanErr(''); setScanResult(null)
    try {
      const r = await getRegistrationById(id)
      if (!r) { setScanErr('Ticket no encontrado'); setScanning(false); return }
      setScanResult(r)
    } catch { setScanErr('Error al buscar') }
    finally { setScanning(false) }
  }

  const handleCheckIn = async () => {
    if (!scanResult) return
    setScanning(true)
    try {
      await checkInRegistration(scanResult.id)
      setScanResult(r => ({ ...r, checked_in: 1, checked_in_at: new Date().toISOString() }))
    } catch { setScanErr('Error al confirmar') }
    finally { setScanning(false) }
  }

  const handleUndo = async () => {
    if (!scanResult) return
    setScanning(true)
    try {
      await undoCheckInRegistration(scanResult.id)
      setScanResult(r => ({ ...r, checked_in: 0, checked_in_at: null }))
    } catch { setScanErr('Error al deshacer') }
    finally { setScanning(false) }
  }

  const isCheckedIn = scanResult?.checked_in === 1 || scanResult?.checked_in === '1'

  return (
    <div className="adm-checkin">
      <div className="adm-section-lbl">CHECK-IN · ESCANEAR TICKET</div>

      <form onSubmit={handleLookup} className="adm-checkin__scan">
        <input
          type="text"
          inputMode="numeric"
          className="adm-checkin__input"
          value={ticketId}
          onChange={e => { setTicketId(e.target.value); setScanErr('') }}
          placeholder="Ingresa el # de ticket..."
        />
        <button type="submit" className="adm-checkin__btn" disabled={scanning || !ticketId.trim()}>
          {scanning ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {scanErr && <p className="adm-checkin__err">{scanErr}</p>}

      {scanResult && (
        <div className={`adm-checkin__result ${isCheckedIn ? 'adm-checkin__result--ok' : ''}`}>
          <div className={`adm-checkin__badge ${isCheckedIn ? 'adm-checkin__badge--ok' : 'adm-checkin__badge--pending'}`}>
            {isCheckedIn ? 'YA CONFIRMADO' : 'PENDIENTE'}
          </div>

          <div className="adm-checkin__info">
            <div className="adm-checkin__row">
              <span className="adm-checkin__label">Ticket</span>
              <span className="adm-checkin__val">#{String(scanResult.id).padStart(4, '0')}</span>
            </div>
            <div className="adm-checkin__row adm-checkin__row--name">
              <span className="adm-checkin__label">Persona</span>
              <span className="adm-checkin__val adm-checkin__val--name">{scanResult.full_name}</span>
            </div>
            <div className="adm-checkin__row">
              <span className="adm-checkin__label">Actividad</span>
              <span className="adm-checkin__val">{scanResult.activity_name || '—'}</span>
            </div>
            {scanResult.event_name && (
              <div className="adm-checkin__row">
                <span className="adm-checkin__label">Evento</span>
                <span className="adm-checkin__val">{scanResult.event_name}</span>
              </div>
            )}
            <div className="adm-checkin__row">
              <span className="adm-checkin__label">Teléfono</span>
              <span className="adm-checkin__val">{scanResult.phone}</span>
            </div>
            <div className="adm-checkin__row">
              <span className="adm-checkin__label">Pago</span>
              <span className="adm-checkin__val">{scanResult.payment_method === 'transferencia' ? 'Transferencia' : scanResult.payment_method || 'Presencial'}</span>
            </div>
          </div>

          {isCheckedIn ? (
            <button className="adm-checkin__action adm-checkin__action--undo" onClick={handleUndo} disabled={scanning}>
              {scanning ? 'Procesando...' : 'Deshacer confirmación'}
            </button>
          ) : (
            <button className="adm-checkin__action adm-checkin__action--confirm" onClick={handleCheckIn} disabled={scanning}>
              {scanning ? 'Confirmando...' : 'Confirmar entrada'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard({ onClose }) {
  const [currentUser, setCurrentUser] = useState(() => tokenFromStorage()?.payload?.sub ?? null)
  const [userRole, setUserRole]       = useState(() => tokenFromStorage()?.payload?.role ?? 'admin')
  const [userPerms, setUserPerms]     = useState(() => tokenFromStorage()?.payload?.permissions ?? null)
  const [fallback, setFallback]       = useState(false)
  const authed = !!currentUser
  const isAdmin = userRole === 'admin'
  const canSee = (key) => {
    if (isAdmin) return true
    if (key === 'users') return false
    if (key === 'contenido') return userPerms?.actividades === true || userPerms?.eventos === true
    return userPerms?.[key] === true
  }

  const [period, setPeriod]   = useState(PERIODS[2])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [time, setTime]       = useState(clock())
  const [tab, setTab]         = useState('stats')
  const [insDateFrom, setInsDateFrom] = useState('')
  const [insDateTo,   setInsDateTo]   = useState('')

  const load = useCallback(async (days) => {
    setLoading(true)
    const data = await getStats(days)
    setStats(data)
    setLoading(false)
  }, [])

  // Verify stored token with the server on mount (catches tampered or expired tokens)
  useEffect(() => {
    const stored = tokenFromStorage()
    if (!stored) return
    adminVerifyToken(stored.token).then(result => {
      if (!result.ok) {
        sessionStorage.removeItem('adm_token')
        setCurrentUser(null)
        setUserRole('admin')
        setUserPerms(null)
      }
    }).catch(() => { /* network error — keep session, server will re-check on next operation */ })
  }, [])

  useEffect(() => { if (authed) load(period.days) }, [authed, period, load])
  useEffect(() => { const t = setInterval(() => setTime(clock()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (!authed) return
    const t = setInterval(() => load(period.days), 30000)
    return () => clearInterval(t)
  }, [authed, period, load])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const login = (token, isFallback = false) => {
    const payload = decodeJWT(token)
    if (!payload) return
    sessionStorage.setItem('adm_token', token)
    setCurrentUser(payload.sub)
    setFallback(isFallback)
    setUserRole(payload.role ?? 'admin')
    setUserPerms(payload.permissions ?? null)
    if (payload.role !== 'admin' && payload.permissions) {
      const first = PERMS_CONFIG.find(p => payload.permissions[p.key])
      setTab(first?.key ?? 'stats')
    }
  }
  const logout = () => {
    sessionStorage.removeItem('adm_token')
    setCurrentUser(null)
    setUserRole('admin')
    setUserPerms(null)
    setStats(null)
    onClose()
  }

  const handleClear = async () => {
    if (!confirm('¿Borrar todos los eventos? Esta acción no se puede deshacer.')) return
    await clearEvents()
    load(period.days)
  }

  // Acumulado
  const aMsg   = cnt(stats?.byType, 'bot_message')
  const aWA    = cnt(stats?.byType, 'whatsapp_click')
  const aRes   = cnt(stats?.byType, 'reserva_click')
  const aConf  = cnt(stats?.byType, 'reserva_confirmada')
  const aRegI  = cnt(stats?.byType, 'activity_reg_intent')
  // Inscripciones confirmadas: conteo REAL de activity_registrations (coincide con la pestaña Inscripciones)
  const aRegC  = stats?.regConfirmed ?? cnt(stats?.byType, 'activity_reg_confirm')

  // Hoy
  const tMsg   = cnt(stats?.todayByType, 'bot_message')
  const tWA    = cnt(stats?.todayByType, 'whatsapp_click')
  const tRes   = cnt(stats?.todayByType, 'reserva_click')
  const tConf  = cnt(stats?.todayByType, 'reserva_confirmada')
  const tRegI  = cnt(stats?.todayByType, 'activity_reg_intent')
  const tRegC  = stats?.regConfirmedToday ?? cnt(stats?.todayByType, 'activity_reg_confirm')

  // Ayer (delta)
  const yMsg   = cnt(stats?.yesterdayByType, 'bot_message')
  const yWA    = cnt(stats?.yesterdayByType, 'whatsapp_click')
  const yRes   = cnt(stats?.yesterdayByType, 'reserva_click')
  const yConf  = cnt(stats?.yesterdayByType, 'reserva_confirmada')
  const yRegI  = cnt(stats?.yesterdayByType, 'activity_reg_intent')
  const yRegC  = stats?.regConfirmedYesterday ?? cnt(stats?.yesterdayByType, 'activity_reg_confirm')

  const chartData = buildChartData(stats?.byDayType)

  return (
    <div className="adm-overlay">
      {!authed ? (
        <LoginScreen onLogin={login} />
      ) : (
        <div className="adm-dash">

          {/* Header */}
          <div className="adm-dash__header">
            <div className="adm-dash__hl">
              <div className="adm-dash__logo-box">
                <img src="/logo/icono.svg" alt="logo" className="adm-dash__logo"/>
              </div>
              <div>
                <div className="adm-dash__name">
                  Hotel Punta Galería
                  <span className={`adm-dash__badge${isAdmin ? '' : ' adm-dash__badge--editor'}`}>{isAdmin ? 'Admin' : 'Editor'}</span>
                </div>
                <div className="adm-dash__live">
                  <span className="adm-live-dot"/>
                  Live · {time} · {period.label} · <strong>{currentUser}</strong>
                </div>
              </div>
            </div>
            {tab === 'stats' && (
              <div className="adm-dash__hc">
                {PERIODS.map(p => (
                  <button key={p.label} className={`adm-period-btn ${period.label === p.label ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <div className="adm-dash__hr">
              <button className="adm-hbtn" onClick={() => load(period.days)} disabled={loading} title="Actualizar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>
              <button className="adm-hbtn" onClick={handleClear} title="Limpiar datos">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
              <button className="adm-hbtn adm-hbtn--primary" onClick={logout} title="Salir">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>

          {/* Tab + period bar */}
          <div className="adm-period-bar">
            {/* Todas las tabs visibles (planas) para cualquier usuario. */}
            {TAB_GROUPS.flatMap(g => g.items).filter(([k]) => canSee(k)).map(([k, label]) => {
              const active = tab === k || (k === 'contenido' && (tab === 'actividades' || tab === 'eventos'))
              return (
                <button key={k} className={`adm-period-btn adm-tab-btn ${active ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>
              )
            })}
            {isAdmin && <button className={`adm-period-btn adm-tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Usuarios</button>}
            {(tab === 'inscripciones' || tab === 'reservas') && (
              <div className="adm-bar-daterange">
                <span className="adm-bar-daterange__label">Período</span>
                <DatePicker value={insDateFrom} onChange={setInsDateFrom} placeholder="Desde" allowPast />
                <span className="adm-bar-datesep">→</span>
                <DatePicker value={insDateTo} onChange={setInsDateTo} placeholder="Hasta" allowPast />
              </div>
            )}
          </div>

          {/* Fallback warning */}
          {fallback && (
            <div className="adm-fallback-warn">
              ⚠️ Estás usando la contraseña de emergencia (.env). Crea un usuario en la pestaña <strong>Usuarios</strong> para mayor seguridad.
            </div>
          )}

          {/* Body */}
          <div className="adm-dash__body">
            {tab === 'users' ? (
              <UsersSection currentUser={currentUser} userRole={userRole} />
            ) : (tab === 'contenido' || tab === 'actividades' || tab === 'eventos') ? (
              <ContenidoSection canSee={canSee} initial={tab === 'eventos' ? 'eventos' : 'actividades'} />
            ) : tab === 'reservas' ? (
              <HotelReservationsSection dateFrom={insDateFrom} dateTo={insDateTo} isAdmin={isAdmin} />
            ) : tab === 'inscripciones' ? (
              <ActivityRegistrationsSection dateFrom={insDateFrom} dateTo={insDateTo} isAdmin={isAdmin} />
            ) : tab === 'reportes' ? (
              <ReportesSection />
            ) : tab === 'google' ? (
              <SearchConsoleTab />
            ) : loading && !stats ? (
              <p className="adm-loading">Cargando estadísticas…</p>
            ) : (
              <>
                {/* Acumulado */}
                <div className="adm-section-lbl">ACUMULADO · {period.label}</div>
                <div className="adm-grid5">
                  <StatCard label="INTENTOS HOTEL" value={aRes}          sub="abrieron reserva" Icon={IcoCal}   />
                  <StatCard label="RESERVAS HOTEL" value={aConf}         sub="enviaron a WA"    Icon={IcoCheck} />
                  <StatCard label="INTENTOS ACT." value={aRegI}          sub="iniciaron registro" Icon={IcoCal}   />
                  <StatCard label="INSCRIPCIONES" value={aRegC}           sub="confirmaron registro"  Icon={IcoCheck} />
                  <StatCard label="SESIONES"     value={stats?.sessions} sub="únicas"            Icon={IcoUsers} />
                </div>

                {/* Hoy */}
                <div className="adm-section-lbl">HOY · {todayLabel()}</div>
                <div className="adm-grid5">
                  <StatCard label="INTENTOS HOTEL" value={tRes}   sub="hoy" Icon={IcoCal}   delta={diff(tRes,  yRes)}  />
                  <StatCard label="RESERVAS HOTEL" value={tConf}  sub="hoy" Icon={IcoCheck} delta={diff(tConf, yConf)} />
                  <StatCard label="INTENTOS ACT." value={tRegI}  sub="hoy" Icon={IcoCal}   delta={diff(tRegI, yRegI)} />
                  <StatCard label="INSCRIPCIONES" value={tRegC}  sub="hoy" Icon={IcoCheck} delta={diff(tRegC, yRegC)} />
                  <StatCard label="SESIONES"     value={null}   sub="hoy" Icon={IcoUsers} />
                </div>

                {/* Conversiones */}
                <div className="adm-section-lbl">CONVERSIONES · {period.label}</div>
                <div className="adm-conv-row adm-conv-row--3" style={{ marginBottom: 12 }}>
                  <div className="adm-conv-panel">
                    <p className="adm-conv-title">
                      <IcoWA /> WhatsApp por sección
                    </p>
                    <ConversionList data={stats?.waSources} labels={WA_LABELS} color="#25d366" />
                  </div>
                  <div className="adm-conv-panel">
                    <p className="adm-conv-title">
                      <IcoCal /> Intentos de inscripción
                    </p>
                    <ConversionList data={stats?.intentSources} labels={{}} color="#7a8c2e" />
                  </div>
                  <div className="adm-conv-panel">
                    <p className="adm-conv-title">
                      <IcoCheck /> Inscripciones confirmadas
                    </p>
                    <ConversionList data={stats?.regConfirmSources} labels={{}} color="#b5c840" />
                  </div>
                </div>

                <div className="adm-conv-row">
                  <div className="adm-conv-panel">
                    <p className="adm-conv-title">
                      <IcoCal /> Intentos de reserva (Hotel)
                    </p>
                    <ConversionList data={stats?.reservaSources} labels={RESERVA_LABELS} color="#7a8c2e" />
                  </div>
                  <div className="adm-conv-panel">
                    <p className="adm-conv-title">
                      <IcoCheck /> Reservas confirmadas (Hotel)
                    </p>
                    <ConversionList data={stats?.confirmaSources} labels={RESERVA_LABELS} color="#b5c840" />
                  </div>
                </div>

                {/* Charts */}
                <div className="adm-charts-row">
                  <div className="adm-chart-panel">
                    <p className="adm-chart-panel__title">Distribución de tipos</p>
                    <Distribution byType={stats?.byType} />
                  </div>
                  <div className="adm-chart-panel adm-chart-panel--wide">
                    <p className="adm-chart-panel__title">Actividad — últimos 14 días</p>
                    <LineChart data={chartData} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────
function IcoUsers() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IcoMsg() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function IcoWA() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
}
function IcoGrid() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function IcoCal() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IcoCheck() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
