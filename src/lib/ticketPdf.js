import { compressImage } from './utils'
import { saveTransferProof, API_BASE } from './turso'

const PW = 390
const PH = 844

export function generateTicketPdfHtml({
  registrationId,
  fullName,
  eventName,
  eventDescription,
  eventDate,
  eventPrice,
  qrSvgEl,
}) {
  const svgStr = qrSvgEl ? new XMLSerializer().serializeToString(qrSvgEl) : ''
  const svgB64 = svgStr ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}` : ''
  const ticketNum = String(registrationId).padStart(4, '0')
  const dateStr = eventDate
    ? new Date(eventDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
@page{size:${PW}px ${PH}px;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${PW}px;height:${PH}px;overflow:hidden}
body{font-family:'Montserrat',sans-serif;background:#5a6c1e;display:flex;flex-direction:column}
.top{background:#5a6c1e;padding:24px 22px 18px;text-align:center;color:#fff;flex-shrink:0}
.hotel{font-size:9px;font-weight:800;letter-spacing:2.5px;opacity:0.6;margin-bottom:6px;text-transform:uppercase}
.event-name{font-size:22px;font-weight:900;line-height:1.1;margin-bottom:5px}
.event-desc{font-size:11px;font-weight:500;opacity:0.82;line-height:1.4}
.body{background:#fff;flex:1;display:flex;flex-direction:column;align-items:center;padding:16px 18px 0;overflow:hidden}
.qr-wrap{background:#f7f8f3;border-radius:14px;padding:12px;margin-bottom:10px;flex-shrink:0}
.qr-wrap img{width:200px;height:200px;display:block}
.ticket-info{text-align:center;margin-bottom:10px;flex-shrink:0}
.ticket-num{font-size:10px;font-weight:800;color:#8fa03a;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:3px}
.ticket-name{font-size:18px;font-weight:900;color:#111;line-height:1.1}
.hint{display:inline-flex;align-items:center;gap:5px;background:#eef4e8;border:1.5px solid #c9d98a;border-radius:99px;padding:4px 11px;font-size:9px;font-weight:700;color:#4a5a1e;margin-top:5px}
.divider{width:100%;border:none;border-top:1.5px solid #f0f0ec;margin:0 0 10px;flex-shrink:0}
.meta{width:100%;display:flex;flex-direction:column;gap:6px;flex-shrink:0}
.row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f7f8f3;border-radius:9px}
.lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#8fa03a}
.val{font-size:12px;font-weight:700;color:#1a1a1a}
.footer{background:#5a6c1e;width:100%;padding:12px 22px;text-align:center;font-size:9px;color:rgba(255,255,255,0.7);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;flex-shrink:0;margin-top:auto}
</style></head><body>
<div class="top">
  <div class="hotel">Hotel Punta Galería</div>
  <div class="event-name">${eventName || ''}</div>
  ${eventDescription ? `<div class="event-desc">${eventDescription}</div>` : ''}
</div>
<div class="body">
  ${svgB64 ? `<div class="qr-wrap"><img src="${svgB64}" alt="QR"/></div>` : ''}
  <div class="ticket-info">
    <div class="ticket-num">Ticket #${ticketNum}</div>
    <div class="ticket-name">${fullName}</div>
    <div class="hint"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>Entrada confirmada</div>
  </div>
  <hr class="divider"/>
  <div class="meta">
    <div class="row"><span class="lbl">Nombre</span><span class="val">${fullName}</span></div>
    ${dateStr ? `<div class="row"><span class="lbl">Fecha</span><span class="val">${dateStr}</span></div>` : ''}
    ${eventPrice > 0 ? `<div class="row"><span class="lbl">Precio</span><span class="val">$${parseFloat(eventPrice).toFixed(2)} MXN</span></div>` : ''}
  </div>
</div>
<div class="footer">Presenta este QR en la entrada · Hotel Punta Galería</div>
</body></html>`
}

export async function downloadTicketPdf({ registrationId, fullName, event, qrSvgEl }) {
  const html = generateTicketPdfHtml({
    registrationId,
    fullName,
    eventName: event?.name || '',
    eventDescription: event?.description || '',
    eventDate: event?.date || '',
    eventPrice: event?.price || 0,
    qrSvgEl,
  })
  const ticketNum = String(registrationId).padStart(4, '0')
  const res = await fetch(`${API_BASE}/.netlify/functions/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename: `ticket-${ticketNum}.pdf`, pageWidth: PW, pageHeight: PH })
  })
  if (!res.ok) throw new Error('Error generando PDF')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ticket-${ticketNum}.pdf`
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
