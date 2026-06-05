#!/usr/bin/env node
/**
 * Ejecuta UNA VEZ para obtener el refresh token de Google Search Console.
 * Uso:  node scripts/gsc-auth.mjs <CLIENT_ID> <CLIENT_SECRET>
 */
import { createServer } from 'http'
import { readFileSync } from 'fs'

// Carga .env (raíz del proyecto) sin dependencias, si existe.
function loadDotEnv() {
  for (const f of ['.env', '.env.local']) {
    try {
      readFileSync(f, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      })
    } catch { /* sin .env */ }
  }
}
loadDotEnv()

// Acepta args O variables de entorno (GSC_CLIENT_ID / GSC_CLIENT_SECRET en .env).
const CLIENT_ID     = process.argv[2] || process.env.GSC_CLIENT_ID
const CLIENT_SECRET = process.argv[3] || process.env.GSC_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\nUso: node scripts/gsc-auth.mjs [CLIENT_ID] [CLIENT_SECRET]')
  console.error('(o define GSC_CLIENT_ID y GSC_CLIENT_SECRET en .env y corre sin argumentos)\n')
  console.error('Obtén CLIENT_ID y CLIENT_SECRET en:')
  console.error('  console.cloud.google.com → APIs y servicios → Credenciales → Crear credencial → ID de cliente OAuth 2.0')
  console.error('  Tipo: Aplicación de escritorio')
  console.error('  URI de redireccionamiento autorizado: http://localhost:4567\n')
  console.error('IMPORTANTE para que el token NO caduque cada 7 días:')
  console.error('  Pantalla de consentimiento OAuth → estado de publicación: "En producción" (no "En prueba").\n')
  process.exit(1)
}

// Evita usar placeholders del .env (p.ej. "...") que provocan "Error 401: invalid_client".
if (!/\.apps\.googleusercontent\.com$/.test(CLIENT_ID) || CLIENT_SECRET.length < 10) {
  console.error('\n❌ CLIENT_ID / CLIENT_SECRET inválidos (parecen placeholders del .env).')
  console.error(`   CLIENT_ID recibido: "${CLIENT_ID}"`)
  console.error('   El CLIENT_ID real termina en ".apps.googleusercontent.com".')
  console.error('   Pásalos como argumentos con los valores REALES (de Netlify env vars o Google Cloud):')
  console.error('   node scripts/gsc-auth.mjs <CLIENT_ID_REAL> <CLIENT_SECRET_REAL>\n')
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
    console.log(`GOOGLE_SITE_URL=${process.env.GOOGLE_SITE_URL || ''}`)
    console.log('\nY también en tu .env local para desarrollo.')
    console.log('Si vuelve a caducar en ~7 días: publica la pantalla de consentimiento OAuth como "En producción".\n')
  } else {
    console.error('\n❌ No se recibió refresh_token:', JSON.stringify(tokens))
    console.error('Asegúrate de haber agregado http://localhost:4567 como URI autorizado en Google Cloud.\n')
  }
  process.exit(0)
})

server.listen(4567)
