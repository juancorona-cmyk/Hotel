import { API_BASE } from './turso'

const LOGO_URL = 'https://hotelpuntagaleria.mx/logo/logNegro.svg'
const PW = 794  // A4 width @ 96dpi
const PH = 1123 // A4 height @ 96dpi

export const PET_POLICY_RULES = [
  'Peso máximo de la mascota: 15 kg (33 lb).',
  'Debe traer su propia cama para mascota; de no ser así, se le asignará una (cama, plato de alimento y agua) que se devuelve a la salida.',
  'SIN EXCEPCIÓN debe portar correa atada al cuello en todo momento dentro del hotel.',
  'Toda mascota debe estar supervisada por una persona SIEMPRE.',
  'Prohibido dejar a la mascota sola en la habitación. De detectarse, se llamará a las autoridades para retirarla.',
  'Solo 2 habitaciones Pet Friendly disponibles — se sugiere reservar con anticipación.',
  'Aplica cargo por noche por mascota, por limpieza e higienización.',
  'Una sola mascota por habitación. Prohibido subirse al mobiliario de la habitación, restaurante o lobby.',
  'La higiene de la mascota y de su área es responsabilidad total del propietario.',
  'La camarista no podrá limpiar la habitación si la mascota está sola dentro. Sea un dueño responsable.',
  'No se permite el ingreso al comedor. Puede estar en jardines/terraza del restaurante, con correa y supervisión, sin acceder a terrazas de otras habitaciones.',
  'El dueño debe portar bolsas para recoger heces. Cualquier daño causado por la mascota es RESPONSABILIDAD TOTAL del propietario.',
  'Se debe respetar la tranquilidad de los demás huéspedes. La gerencia se reserva el derecho de admisión de la mascota bajo su propio criterio.',
]

export function generatePetPolicyHtml({ guestName = '', roomNumber = '', checkinDate = '' } = {}) {
  const dateStr = checkinDate
    ? new Date(checkinDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const rulesHtml = PET_POLICY_RULES.map(r => `<li>${r}</li>`).join('')

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${PW}px;height:${PH}px;background:#fff}
body{font-family:'Montserrat',sans-serif;color:#1a1a1a;-webkit-print-color-adjust:exact;border:1px solid #e4e4dc;display:flex;flex-direction:column}
:root{color-scheme:light}

.header{background:#4a5a1e;padding:34px 50px 30px;text-align:center;color:#fff;flex-shrink:0}
.header img{height:44px;margin-bottom:12px;filter:brightness(0) invert(1)}
.header h1{font-size:22px;font-weight:900;letter-spacing:0.2px}
.header p{font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);margin-top:5px;letter-spacing:0.3px}

.body-content{flex:1;padding:28px 50px 0;display:flex;flex-direction:column}

.intro{font-size:11px;line-height:1.65;color:#444;margin-bottom:20px}

.section-label{font-size:9px;font-weight:800;letter-spacing:2px;color:#8fa03a;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.section-label::after{content:'';flex:1;height:1px;background:#e4e4dc}

ol{column-count:2;column-gap:36px;margin-bottom:22px}
ol li{font-size:10px;line-height:1.6;color:#222;margin-bottom:13px;break-inside:avoid;padding-left:3px}
ol li::marker{font-weight:800;color:#4a5a1e}

.guest-box{background:#f5f7ee;border:1.3px solid #c9d98a;border-radius:9px;padding:12px 20px;display:flex;justify-content:space-between;font-size:10.5px;font-weight:700;color:#4a5a1e}

.sign-section{margin-top:auto;padding:22px 0 30px;border-top:1.3px dashed #c9d98a}
.sign-row{display:flex;gap:40px;margin-top:56px}
.sign-block{flex:1;text-align:center}
.sign-line{border-top:1.2px solid #333;padding-top:6px;font-size:9.5px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:0.4px}

.footer{background:#4a5a1e;padding:14px 50px;text-align:center;flex-shrink:0}
.footer span{font-size:8px;color:rgba(255,255,255,0.65);font-weight:700;letter-spacing:2px;text-transform:uppercase}
</style></head><body>

<div class="header">
  <img src="${LOGO_URL}" alt="Hotel Punta Galería"/>
  <h1>Reglamento para Huéspedes con Mascotas</h1>
  <p>Habitaciones Pet Friendly · Hotel Punta Galería, Morelia</p>
</div>

<div class="body-content">
  <div class="intro">
    Nos llena de alegría recibirlos a ustedes y a sus queridas mascotas, parte de su familia. Hemos preparado un
    espacio para que todos disfruten de una estancia cómoda y segura. Por favor lea el siguiente reglamento antes de firmar.
  </div>

  <div class="section-label">Requerimientos y condiciones</div>
  <ol>${rulesHtml}</ol>

  <div class="guest-box">
    <span>Huésped: ${guestName || '_______________________________'}</span>
    <span>Habitación: ${roomNumber || '_______'}</span>
  </div>

  <div class="sign-section">
    <div class="sign-row">
      <div class="sign-block">
        <div class="sign-line">Firma del huésped responsable</div>
      </div>
      <div class="sign-block">
        <div class="sign-line">Fecha ${dateStr ? `· ${dateStr}` : ''}</div>
      </div>
    </div>
  </div>
</div>

<div class="footer"><span>Hotel Punta Galería · hotelpuntagaleria.mx</span></div>

</body></html>`
}

export async function generatePetPolicyPdfBlob(params = {}) {
  const html = generatePetPolicyHtml(params)
  const res = await fetch(`${API_BASE}/.netlify/functions/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename: 'reglamento-mascotas.pdf', pageWidth: PW, pageHeight: PH })
  })
  if (!res.ok) throw new Error('Error generando PDF')
  return { blob: await res.blob(), filename: 'reglamento-mascotas.pdf' }
}

export async function downloadPetPolicyPdf(params = {}) {
  const { blob, filename } = await generatePetPolicyPdfBlob(params)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function openPetPolicyPdf(params = {}) {
  const win = window.open('', '_blank')
  try {
    const { blob } = await generatePetPolicyPdfBlob(params)
    const url = URL.createObjectURL(blob)
    if (win) win.location.href = url
    else window.open(url, '_blank')
  } catch (e) {
    if (win) win.close()
    throw e
  }
}
