import { compressImage } from './utils'
import { saveTransferProof, API_BASE } from './turso'

const PW = 390
const PH = 900

export function generateTicketPdfHtml({
  registrationId,
  fullName,
  eventName,
  eventDescription,
  eventDate,
  eventPrice,
  qrDataUrl,
  paymentMethod,
  paymentPending,
}) {
  const ticketNum = String(registrationId).padStart(4, '0')
  const dateStr = eventDate
    ? new Date(eventDate + 'T12:00:00').toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''

  const descHtml = eventDescription
    ? `<p class="ev-desc">${eventDescription}</p>`
    : ''

  const icoLocation = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8fa03a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`
  const icoPrice  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8fa03a" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2m-3-7h4.5a1.5 1.5 0 0 1 0 3H9a1.5 1.5 0 0 0 0 3H14"/></svg>`
  const icoTicket = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8fa03a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a2 2 0 0 1 0-4V3h20v2a2 2 0 0 1 0 4v2a2 2 0 0 1 0 4v2H2v-2a2 2 0 0 1 0-4V9z"/><line x1="9" y1="3" x2="9" y2="21" stroke-dasharray="3 3"/></svg>`
  const icoDate   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8fa03a" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
  const icoScan   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a5a1e" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><line x1="16" y1="16" x2="16" y2="21"/><line x1="16" y1="16" x2="21" y2="16"/><line x1="21" y1="19" x2="21" y2="21"/><line x1="19" y1="21" x2="21" y2="21"/></svg>`
  const icoPayment = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8fa03a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`

  let paymentLabel = ''
  let paymentClass = 'val--green'
  if (paymentMethod === 'presencial') {
    paymentLabel = 'Presencial · Pagar en recepción'
    paymentClass = 'val--blue'
  } else if (paymentMethod === 'transferencia') {
    paymentLabel = paymentPending ? 'Transferencia · Pendiente' : 'Transferencia · Pagado ✓'
    paymentClass = paymentPending ? 'val--amber' : 'val--green'
  }
  const paymentRow = paymentLabel
    ? `<div class="row"><div class="row-left">${icoPayment}<span class="lbl">Pago</span></div><span class="val ${paymentClass}">${paymentLabel}</span></div>`
    : ''

  const dateRow = dateStr
    ? `<div class="row"><div class="row-left">${icoDate}<span class="lbl">Fecha</span></div><span class="val">${dateStr}</span></div>`
    : ''

  const priceRow = eventPrice > 0
    ? `<div class="row"><div class="row-left">${icoPrice}<span class="lbl">Precio</span></div><span class="val val--green">$${parseFloat(eventPrice).toFixed(2)} MXN</span></div>`
    : `<div class="row"><div class="row-left">${icoPrice}<span class="lbl">Precio</span></div><span class="val val--green">Gratis</span></div>`

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
@page{size:${PW}px ${PH}px;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${PW}px;height:${PH}px;overflow:hidden;-webkit-print-color-adjust:exact}
body{font-family:'Montserrat',sans-serif;background:#fff;display:flex;flex-direction:column}

/* ── Header ── */
.header{background:#4a5a1e;padding:20px 22px 18px;text-align:center;color:#fff;flex-shrink:0}
.hotel-label{font-size:8.5px;font-weight:800;letter-spacing:3px;color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:4px}
.event-title{font-size:24px;font-weight:900;line-height:1.1;letter-spacing:-0.3px}

/* ── QR zone ── */
.qr-zone{background:#f5f7ee;display:flex;flex-direction:column;align-items:center;padding:18px 22px 14px;border-bottom:2px dashed #d4dfa8;flex-shrink:0}
.qr-frame{background:#fff;border-radius:16px;padding:10px;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
.qr-frame img{width:190px;height:190px;display:block;image-rendering:crisp-edges;image-rendering:pixelated}
.ticket-badge{display:inline-flex;align-items:center;gap:6px;margin-top:12px;background:#4a5a1e;color:#fff;border-radius:99px;padding:4px 14px 4px 10px;font-size:10px;font-weight:800;letter-spacing:0.5px}
.ticket-badge .check{width:16px;height:16px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center}

/* ── Attendee ── */
.attendee{padding:14px 22px 12px;text-align:center;border-bottom:1.5px solid #f0f0ec;flex-shrink:0}
.att-num{font-size:9px;font-weight:800;color:#8fa03a;letter-spacing:2px;text-transform:uppercase;margin-bottom:2px}
.att-name{font-size:20px;font-weight:900;color:#111;line-height:1.1}

/* ── Event info ── */
.ev-section{padding:14px 22px 12px;border-bottom:1.5px solid #f0f0ec;flex-shrink:0}
.ev-section-label{font-size:8px;font-weight:800;letter-spacing:2.5px;color:#9aab52;text-transform:uppercase;margin-bottom:5px}
.ev-name{font-size:15px;font-weight:900;color:#1a1a1a;margin-bottom:4px}
.ev-desc{font-size:10.5px;font-weight:500;color:#555;line-height:1.5}

/* ── Meta rows ── */
.meta{padding:12px 22px;display:flex;flex-direction:column;gap:7px;flex-shrink:0}
.row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f7f8f3;border-radius:9px;gap:8px}
.row-left{display:flex;align-items:center;gap:6px}
.lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#8fa03a}
.val{font-size:11px;font-weight:700;color:#1a1a1a;text-align:right;flex:1}
.val--green{color:#4a5a1e;font-weight:900}
.val--blue{color:#1d4ed8;font-weight:900}
.val--amber{color:#b45309;font-weight:900}

/* ── Instructions ── */
.instructions{padding:10px 22px 8px;flex-shrink:0}
.instr-box{background:#f5f7ee;border:1.5px solid #c9d98a;border-radius:12px;padding:10px 14px;text-align:center}
.instr-text{font-size:10px;font-weight:700;color:#4a5a1e;line-height:1.5}

/* ── Footer ── */
.footer{background:#4a5a1e;margin-top:auto;padding:10px 22px;text-align:center;flex-shrink:0}
.footer-text{font-size:8px;color:rgba(255,255,255,0.6);font-weight:700;letter-spacing:2px;text-transform:uppercase}
</style></head><body>

<div class="header">
  <div class="hotel-label">Hotel Punta Galería · Morelia, Mich.</div>
  <div class="event-title">${eventName || 'Evento'}</div>
</div>

<div class="qr-zone">
  <div class="qr-frame">
    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Ticket"/>` : '<div style="width:190px;height:190px;background:#f0f0ec;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#aaa;">Sin QR</div>'}
  </div>
  <div class="ticket-badge">
    <div class="check"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
    Ticket #${ticketNum} · Entrada confirmada
  </div>
</div>

<div class="attendee">
  <div class="att-num">Asistente</div>
  <div class="att-name">${fullName}</div>
</div>

<div class="ev-section">
  <div class="ev-section-label">Sobre el evento</div>
  <div class="ev-name">${eventName || ''}</div>
  ${descHtml}
</div>

<div class="meta">
  ${dateRow}
  <div class="row">
    <div class="row-left">${icoLocation}<span class="lbl">Lugar</span></div>
    <span class="val">Hotel Punta Galería, Morelia</span>
  </div>
  ${priceRow}
  ${paymentRow}
  <div class="row">
    <div class="row-left">${icoTicket}<span class="lbl">Ticket</span></div>
    <span class="val">#${ticketNum}</span>
  </div>
</div>

<div class="instructions">
  <div class="instr-box">
    <div class="instr-text">
      <span style="display:inline-flex;align-items:center;gap:5px;justify-content:center">${icoScan} Presenta este QR al personal en la entrada</span><br/>
      Este ticket es personal e intransferible<br/>
      Para soporte: Hotel Punta Galería · Morelia
    </div>
  </div>
</div>

<div class="footer">
  <div class="footer-text">Hotel Punta Galería · hotelpuntagaleria.mx</div>
</div>

</body></html>`
}

export async function generateTicketPdfBlob({ registrationId, fullName, event, qrDataUrl, paymentMethod, paymentPending }) {
  const html = generateTicketPdfHtml({
    registrationId,
    fullName,
    eventName: event?.name || '',
    eventDescription: event?.description || '',
    eventDate: event?.date || '',
    eventPrice: event?.price || 0,
    qrDataUrl,
    paymentMethod,
    paymentPending,
  })
  const ticketNum = String(registrationId).padStart(4, '0')
  const res = await fetch(`${API_BASE}/.netlify/functions/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename: `ticket-${ticketNum}.pdf`, pageWidth: PW, pageHeight: PH })
  })
  if (!res.ok) throw new Error('Error generando PDF')
  return { blob: await res.blob(), filename: `ticket-${ticketNum}.pdf` }
}

export async function downloadTicketPdf(params) {
  const { blob, filename } = await generateTicketPdfBlob(params)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function uploadTransferProof({ file, registrationId, eventName }) {
  const base64 = await compressImage(file)
  const res = await fetch(`${API_BASE}/.netlify/functions/upload-proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, registrationId, eventName })
  })
  const data = await res.json()
  if (!res.ok || !data.url) throw new Error(data.error || 'Error al subir')
  await saveTransferProof(registrationId, data.url)
}
