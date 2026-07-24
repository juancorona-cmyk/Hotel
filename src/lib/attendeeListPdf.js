import { API_BASE } from './turso'
import { saveOrShareBlob } from './nativeDownload'

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function slugify(str) {
  return String(str || 'asistentes')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function generateAttendeeListPdfHtml({ eventName, eventDate, rows, totals, generatedAt }) {
  const dateStr = eventDate
    ? new Date(eventDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Sin fecha'

  const genStr = generatedAt.toLocaleString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const bodyRows = rows.map((r, i) => `
    <tr>
      <td class="c-num">${i + 1}</td>
      <td class="c-name">${escapeHtml(r.name)}</td>
      <td class="c-phone">${escapeHtml(r.phone) || '—'}</td>
      <td class="c-status"><span class="tag tag--${r.statusClass}">${escapeHtml(r.statusLabel)}</span></td>
      <td class="c-att">${r.attended ? '✓' : ''}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
:root{color-scheme:light}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff}
body{font-family:'Montserrat',sans-serif;color:#1a1a1a;padding:36px 42px;-webkit-print-color-adjust:exact}

.header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #4a5a1e;padding-bottom:14px;margin-bottom:16px}
.hotel-label{font-size:9px;font-weight:800;letter-spacing:2.5px;color:#8fa03a;text-transform:uppercase;margin-bottom:4px}
.event-title{font-size:22px;font-weight:900;color:#1a1a1a;letter-spacing:-0.3px}
.event-date{font-size:11.5px;font-weight:600;color:#555;margin-top:2px}
.generated{font-size:9.5px;font-weight:600;color:#888;text-align:right}

.summary{display:flex;gap:10px;margin-bottom:18px}
.sum-card{flex:1;background:#f7f8f3;border:1px solid #e3e8d4;border-radius:10px;padding:8px 12px;text-align:center}
.sum-num{display:block;font-size:17px;font-weight:900;color:#4a5a1e}
.sum-lbl{display:block;font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8fa03a;margin-top:1px}

table{width:100%;border-collapse:collapse}
thead{display:table-header-group}
tr{break-inside:avoid}
th{font-size:8.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#fff;background:#4a5a1e;text-align:left;padding:9px 10px}
td{font-size:11px;font-weight:600;padding:8px 10px;border-bottom:1px solid #eee}
tbody tr:nth-child(even){background:#fafaf7}
.c-num{width:32px}
.c-status{width:120px}
.c-att{width:50px;text-align:center;font-weight:900}
td.c-num{color:#999;font-weight:700}
td.c-name{font-weight:800;color:#1a1a1a}
td.c-phone{color:#555}
td.c-att{color:#4a5a1e}

.tag{display:inline-block;font-size:9px;font-weight:800;padding:3px 9px;border-radius:99px}
.tag--paid{background:#e6efd2;color:#4a5a1e}
.tag--pending{background:#fdecc8;color:#9a6b06}
.tag--transfer{background:#dce6f7;color:#1d4ed8}

.footer{margin-top:18px;font-size:8.5px;color:#aaa;text-align:center}
</style></head><body>

<div class="header">
  <div>
    <div class="hotel-label">Hotel Punta Galería · Morelia, Mich.</div>
    <div class="event-title">${escapeHtml(eventName)}</div>
    <div class="event-date">${dateStr}</div>
  </div>
  <div class="generated">Generado: ${genStr}</div>
</div>

<div class="summary">
  <div class="sum-card"><span class="sum-num">${totals.total}</span><span class="sum-lbl">Total</span></div>
  <div class="sum-card"><span class="sum-num">${totals.paid}</span><span class="sum-lbl">Pagados</span></div>
  <div class="sum-card"><span class="sum-num">${totals.pending}</span><span class="sum-lbl">Pendientes</span></div>
  <div class="sum-card"><span class="sum-num">${totals.attended}</span><span class="sum-lbl">Asistieron</span></div>
</div>

<table>
  <thead>
    <tr>
      <th class="c-num">#</th>
      <th class="c-name">Nombre</th>
      <th class="c-phone">Teléfono</th>
      <th class="c-status">Pago</th>
      <th class="c-att">Asistió</th>
    </tr>
  </thead>
  <tbody>
    ${bodyRows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999">Sin asistentes registrados</td></tr>'}
  </tbody>
</table>

<div class="footer">Hotel Punta Galería · hotelpuntagaleria.mx</div>

</body></html>`
}

export async function downloadAttendeeListPdf({ eventName, eventDate, attendees, isPaid, isCheckedIn, isTransfer }) {
  const generatedAt = new Date()
  const rows = attendees.map(a => {
    const paid = isPaid(a)
    const attended = isCheckedIn(a)
    const transfer = isTransfer(a)
    let statusLabel = 'Presencial'
    let statusClass = 'pending'
    if (paid) {
      statusLabel = transfer ? 'Pago OK' : 'Pagado'
      statusClass = 'paid'
    } else if (transfer) {
      statusLabel = 'Transferencia'
      statusClass = 'transfer'
    }
    return { name: a.full_name, phone: a.phone, attended, statusLabel, statusClass }
  })

  const totals = {
    total: attendees.length,
    paid: attendees.filter(isPaid).length,
    pending: attendees.filter(a => !isPaid(a)).length,
    attended: attendees.filter(isCheckedIn).length,
  }

  const html = generateAttendeeListPdfHtml({ eventName, eventDate, rows, totals, generatedAt })
  const filename = `asistentes-${slugify(eventName)}.pdf`

  const res = await fetch(`${API_BASE}/.netlify/functions/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename, format: 'Letter' }),
  })
  if (!res.ok) throw new Error('Error generando PDF')
  const blob = await res.blob()
  await saveOrShareBlob(blob, filename)
}
