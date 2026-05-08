const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const AUTH_TOKEN = (process.env.TURSO_PROXY_TOKEN || process.env.VITE_TURSO_PROXY_TOKEN || 'change-me-in-production').trim()

// Simple rate limiter — 100 req/min per IP
const RATE_WINDOW = 60_000
const RATE_MAX = 100
const rateMap = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { start: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > RATE_MAX
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // Health-check endpoint — GET returns config status without exposing secrets
  if (req.method === 'GET') {
    const rawUrl = process.env.TURSO_URL || process.env.VITE_TURSO_URL || ''
    const token = (process.env.TURSO_TOKEN || process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_TOKEN || '').trim()
    const proxyToken = process.env.TURSO_PROXY_TOKEN || ''
    const viteProxyToken = process.env.VITE_TURSO_PROXY_TOKEN || ''
    return new Response(JSON.stringify({
      ok: !!(rawUrl && token),
      proxy: 'turso-proxy v2',
      config: {
        TURSO_URL: rawUrl ? `${rawUrl.split('.').slice(-2).join('.')}` : 'MISSING',
        TURSO_TOKEN: token ? 'SET' : 'MISSING',
        TURSO_PROXY_TOKEN: proxyToken ? 'SET' : 'MISSING (using fallback)',
        VITE_TURSO_PROXY_TOKEN: viteProxyToken ? 'SET' : 'MISSING (using fallback)',
        tokensMatch: proxyToken === viteProxyToken || (!proxyToken && !viteProxyToken)
      }
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  // Auth check
  const authHeader = req.headers.get('authorization') || req.headers.get('x-proxy-token')
  const expectedAuth = `Bearer ${AUTH_TOKEN}`
  if (!authHeader || authHeader !== expectedAuth) {
    console.error('Auth mismatch:', {
      hasHeader: !!authHeader,
      headerLen: authHeader?.length,
      expectedLen: expectedAuth.length,
      match: authHeader === expectedAuth
    })
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      detail: 'Proxy token mismatch. Check TURSO_PROXY_TOKEN in Netlify env vars matches VITE_TURSO_PROXY_TOKEN build var.'
    }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Rate limit
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('client-ip') || 'unknown'
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const RAW_URL = process.env.TURSO_URL || process.env.VITE_TURSO_URL || ''
  let TOKEN = (process.env.TURSO_TOKEN || process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_TOKEN || '')

  // Strip ALL whitespace from JWT — copy/paste often introduces spaces, newlines, or tabs
  TOKEN = TOKEN.replace(/\s+/g, '')

  // Handle case where user included "Bearer" prefix in the env var
  if (TOKEN.toLowerCase().startsWith('bearer')) {
    TOKEN = TOKEN.replace(/^bearer/i, '')
  }

  if (!RAW_URL || !TOKEN) {
    const msg = `Config missing: URL=${!!RAW_URL}, Token=${!!TOKEN}`
    console.error(msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Convert libsql:// to https:// and cleanup
  let normalizedUrl = RAW_URL.trim().replace(/^libsql:\/\//, 'https://').replace(/\/$/, '')
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  try {
    const bodyText = await req.text()
    const target = `${normalizedUrl}/v2/pipeline`

    console.log(`DB Proxy: Fetching ${target.split('.').slice(-2).join('.')}...`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000) // Increase to 20s

    try {
      const res = await fetch(target, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: bodyText,
        signal: controller.signal
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error('Turso upstream error:', res.status, errorText)
        
        // Try to parse JSON error from Turso
        let detail = errorText
        try { const j = JSON.parse(errorText); detail = j.error || j.message || errorText } catch {}

        return new Response(JSON.stringify({ 
          error: `Turso API ${res.status}`, 
          detail: detail
        }), {
          status: res.status,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const data = await res.json()
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const isTimeout = err.name === 'AbortError'
    console.error('Turso proxy exception:', err.name, err.message)
    return new Response(JSON.stringify({ 
      error: isTimeout ? 'Database request timed out (20s)' : `Connection failed: ${err.message}`,
      hint: 'Verify TURSO_URL and TURSO_TOKEN in Netlify. Ensure the database is active.'
    }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}
