const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getCleanConfig() {
  let rawUrl = (process.env.TURSO_URL || process.env.VITE_TURSO_URL || '').trim()
  let token = (process.env.TURSO_TOKEN || process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_TOKEN || '').trim()
  
  // Remove quotes
  rawUrl = rawUrl.replace(/^["']|["']$/g, '')
  token = token.replace(/^["']|["']$/g, '')
  
  // Clean token
  token = token.replace(/\s+/g, '')
  if (token.toLowerCase().startsWith('bearer')) {
    token = token.replace(/^bearer/i, '')
  }

  // Normalize URL to origin
  let normalizedUrl = rawUrl.replace(/^libsql:\/\//, 'https://')
  if (normalizedUrl && !normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl
  }
  if (normalizedUrl) {
    try {
      const urlObj = new URL(normalizedUrl)
      normalizedUrl = `${urlObj.protocol}//${urlObj.host}`
    } catch (e) {
      normalizedUrl = normalizedUrl.replace(/\/$/, '')
    }
  }

  return { rawUrl, token, normalizedUrl }
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const { rawUrl, token, normalizedUrl } = getCleanConfig()

  if (req.method === 'GET') {
    let testStatus = 'Not attempted'
    let testDetail = ''
    
    if (normalizedUrl && token) {
      try {
        const testRes = await fetch(`${normalizedUrl}/v2/pipeline`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT 1' } }, { type: 'close' }] })
        })
        if (testRes.ok) {
          testStatus = 'SUCCESS'
        } else {
          testStatus = `FAILED (Status ${testRes.status})`
          testDetail = await testRes.text()
        }
      } catch (e) {
        testStatus = 'EXCEPTION'
        testDetail = e.message
      }
    }

    return new Response(JSON.stringify({
      ok: !!(normalizedUrl && token),
      test: testStatus,
      testDetail: testDetail,
      proxy: 'turso-proxy v4',
      config_debug: {
        URL_PREVIEW: rawUrl ? `${rawUrl.slice(0, 15)}...${rawUrl.slice(-10)}` : 'MISSING',
        TOKEN_PREVIEW: token ? `${token.slice(0, 10)}...${token.slice(-10)} (len: ${token.length})` : 'MISSING',
        NORMALIZED_URL: normalizedUrl,
      }
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  if (!normalizedUrl || !token) {
    return new Response(JSON.stringify({ error: 'Config missing' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const bodyText = await req.text()
    const target = `${normalizedUrl}/v2/pipeline`

    const res = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: bodyText
    })

    if (!res.ok) {
      const errorText = await res.text()
      return new Response(JSON.stringify({ 
        error: `Turso API ${res.status}`, 
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
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: `Connection failed: ${err.message}`
    }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}
