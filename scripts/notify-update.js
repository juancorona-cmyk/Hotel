import { readFileSync } from 'fs'

// Envia push "nueva actualizacion" SOLO en deploy de produccion de Netlify.
// En builds locales (build:apk, dev) no hace nada para no spamear.
const isNetlifyProd = process.env.NETLIFY === 'true' && process.env.CONTEXT === 'production'
if (!isNetlifyProd) {
  console.log('ℹ notify-update: omitido (no es deploy de produccion)')
  process.exit(0)
}

let version = ''
try {
  version = JSON.parse(readFileSync('public/version.json', 'utf8')).version || ''
} catch {}

const ENDPOINT = 'https://hotelpuntagaleria.mx/.netlify/functions/push-notify'

try {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Nueva actualización disponible',
      body: 'Abre el menú y toca Buscar actualizaciones para instalar la versión más reciente.',
      url: 'https://hotelpuntagaleria.mx/checkin',
      tag: 'app-update',
    }),
  })
  const out = await res.text().catch(() => '')
  console.log(`✅ notify-update: push enviado (v${version}) — ${res.status} ${out.slice(0, 120)}`)
} catch (e) {
  // Nunca romper el build por la notificacion
  console.log(`⚠ notify-update: no se pudo enviar (${e.message})`)
}
