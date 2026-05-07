const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const AUTH_TOKEN = process.env.TURSO_PROXY_TOKEN || 'change-me-in-production'

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
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Auth check
  const authHeader = req.headers.get('authorization') || req.headers.get('x-proxy-token')
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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
  const TOKEN = (process.env.TURSO_TOKEN || process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_TOKEN || '').trim()

  if (!RAW_URL || !TOKEN) {
    console.error('Turso configuration missing:', { 
      hasUrl: !!RAW_URL, 
      hasToken: !!TOKEN,
      urlPrefix: RAW_URL.slice(0, 10) + '...' 
    })
    return new Response(JSON.stringify({ 
      error: 'Database configuration missing in Netlify environment variables',
      detail: `URL present: ${!!RAW_URL}, Token present: ${!!TOKEN}`
    }), {
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

    console.log(`DB Proxy: Fetching ${target.split('.')[0]}...`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s

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
        return new Response(JSON.stringify({ 
          error: `Turso API Error ${res.status}`, 
          detail: errorText 
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
      error: isTimeout ? 'Database request timed out (15s)' : `Connection failed: ${err.message}`,
      hint: 'Check if TURSO_URL is correct and the database is accessible.'
    }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}
