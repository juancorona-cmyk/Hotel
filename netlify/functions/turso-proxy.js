import { createHmac, timingSafeEqual } from 'crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Verifica JWT HMAC-SHA256 (mismo esquema que auth.js)
function verifyJWT(token, secret) {
  const parts = token?.split('.')
  if (parts?.length !== 3) return null
  const [h, p, sig] = parts
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  const a = Buffer.from(sig, 'base64url')
  const b = Buffer.from(expected, 'base64url')
  if (a.length !== b.length) return null
  try { if (!timingSafeEqual(a, b)) return null } catch { return null }
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

// SQL sensible: lectura/escritura sobre admin_users (no bloquea CREATE/ALTER de setupDB)
function isSensitiveSQL(bodyText) {
  try {
    const reqs = JSON.parse(bodyText)?.requests || []
    return reqs.some(r => {
      const sql = (r?.stmt?.sql || '').trim()
      return /admin_users/i.test(sql) && /^(insert|update|delete|select)\b/i.test(sql)
    })
  } catch { return false }
}

function getCleanConfig() {
  let rawUrl = (process.env.TURSO_URL || process.env.VITE_TURSO_URL || '').trim()
  let token = (process.env.TURSO_TOKEN || process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_TOKEN || '').trim()
  
  // Clean quotes and spaces
  rawUrl = rawUrl.replace(/^["']|["']$/g, '').trim()
  token = token.replace(/^["']|["']$/g, '').trim().replace(/\s+/g, '')
  if (token.toLowerCase().startsWith('bearer')) token = token.replace(/^bearer/i, '')
  
  // Ensure it's https:// (Node's fetch needs this)
  let normalizedUrl = rawUrl.replace(/^libsql:\/\//, 'https://')
  if (normalizedUrl && !normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  // Remove trailing slashes and normalize
  if (normalizedUrl) {
    try { 
      const urlObj = new URL(normalizedUrl)
      normalizedUrl = `${urlObj.protocol}//${urlObj.host}` 
    } catch (e) { 
      normalizedUrl = normalizedUrl.replace(/\/+$/, '') 
    }
  }

  return { rawUrl, token, normalizedUrl }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const { rawUrl, token, normalizedUrl } = getCleanConfig()

  if (req.method === 'GET') {
    let testStatus = 'Not attempted', testDetail = '', dbInfo = {}
    console.log(`[Diagnostic] Connecting to Turso at: ${normalizedUrl}`)

    if (normalizedUrl && token) {
      try {
        const testRes = await fetch(`${normalizedUrl}/v2/pipeline`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [
            { type: 'execute', stmt: { sql: "SELECT name FROM sqlite_master WHERE type='table'" } },
            { type: 'execute', stmt: { sql: "SELECT COUNT(*) as cnt FROM admin_users" } },
            { type: 'execute', stmt: { sql: "SELECT COUNT(*) as cnt FROM activities" } },
            { type: 'close' }
          ] })
        })
        if (testRes.ok) {
          testStatus = 'SUCCESS'
          const data = await testRes.json()
          dbInfo = {
            tables: data.results?.[0]?.response?.result?.rows?.map(r => r[0].value || r[0]) || [],
            users: data.results?.[1]?.response?.result?.rows?.[0]?.[0]?.value || 0,
            activities: data.results?.[2]?.response?.result?.rows?.[0]?.[0]?.value || 0
          }
        } else {
          testStatus = `FAILED (${testRes.status})`
          testDetail = await testRes.text()
        }
      } catch (e) { 
        testStatus = 'EXCEPTION'
        testDetail = `Diagnostic Error: ${e.message}`
        console.error('[Diagnostic Error]', e)
      }
    }
    return new Response(JSON.stringify({ 
      ok: !!(normalizedUrl && token), 
      test: testStatus, 
      testDetail, 
      dbInfo, 
      proxy: 'turso-proxy v5',
      config: {
        cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'dfuzfdrat'
      }
    }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })
  try {
    const bodyText = await req.text()

    // Seguridad: operaciones sobre admin_users requieren token admin valido
    if (isSensitiveSQL(bodyText)) {
      const secret = process.env.ADMIN_JWT_SECRET
      const auth = req.headers.get('authorization') || ''
      const clientToken = auth.replace(/^bearer\s+/i, '').trim()
      const payload = secret ? verifyJWT(clientToken, secret) : null
      if (!payload || payload.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }

    const res = await fetch(`${normalizedUrl}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: bodyText
    })
    if (!res.ok) {
        const errText = await res.text()
        console.error('Turso DB Server Error:', res.status, errText)
        return new Response(JSON.stringify({ error: `Turso Server Error ${res.status}: ${errText}` }), { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Turso Proxy Connectivity Error:', err)
    return new Response(JSON.stringify({ error: `Turso DB Connection Error: ${err.message}. Verifica que TURSO_URL sea una URL válida de https.` }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
}
