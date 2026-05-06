#!/usr/bin/env node
/**
 * Ejecuta UNA VEZ para obtener el refresh token de Google Search Console.
 * Uso:  node scripts/gsc-auth.mjs <CLIENT_ID> <CLIENT_SECRET>
 */
import { createServer } from 'http'

const [,, CLIENT_ID, CLIENT_SECRET] = process.argv

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\nUso: node scripts/gsc-auth.mjs <CLIENT_ID> <CLIENT_SECRET>\n')
  console.error('Obtén CLIENT_ID y CLIENT_SECRET en:')
  console.error('  console.cloud.google.com → APIs y servicios → Credenciales → Crear credencial → ID de cliente OAuth 2.0')
  console.error('  Tipo: Aplicación de escritorio')
  console.error('  URI de redireccionamiento autorizado: http://localhost:4567\n')
  process.exit(1)
}

const SCOPE        = 'https://www.googleapis.com/auth/webmasters.readonly'
const REDIRECT_URI = 'http://localhost:4567'

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id:     CLIENT_ID,
  redirect_uri:  REDIRECT_URI,
  response_type: 'code',
  scope:         SCOPE,
  access_type:   'offline',
  prompt:        'consent',
})

console.log('\n🔑 Abre este enlace en tu navegador:\n')
console.log(authUrl)
console.log('\nEsperando respuesta en http://localhost:4567 ...\n')

const server = createServer(async (req, res) => {
  const url  = new URL(req.url, 'http://localhost:4567')
  const code = url.searchParams.get('code')
  const err  = url.searchParams.get('error')

  if (err) {
    res.end(`<h2>❌ Error: ${err}</h2>`)
    server.close()
    process.exit(1)
  }
  if (!code) return

  res.end('<h2>✅ ¡Autorizado! Puedes cerrar esta ventana y ver la terminal.</h2>')
  server.close()

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()

  if (tokens.refresh_token) {
    console.log('\n✅ ¡Listo! Agrega estas variables en Netlify → Environment variables:\n')
    console.log(`GSC_CLIENT_ID=${CLIENT_ID}`)
    console.log(`GSC_CLIENT_SECRET=${CLIENT_SECRET}`)
    console.log(`GSC_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log(`GOOGLE_SITE_URL=https://hotelpuntagaleria.mx/`)
    console.log('\nY también en tu .env local para desarrollo.\n')
  } else {
    console.error('\n❌ No se recibió refresh_token:', JSON.stringify(tokens))
    console.error('Asegúrate de haber agregado http://localhost:4567 como URI autorizado en Google Cloud.\n')
  }
  process.exit(0)
})

server.listen(4567)
