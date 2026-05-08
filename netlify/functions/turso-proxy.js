const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getCleanConfig() {
  let rawUrl = (process.env.TURSO_URL || process.env.VITE_TURSO_URL || '').trim()
  let token = (process.env.TURSO_TOKEN || process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_TOKEN || '').trim()
  rawUrl = rawUrl.replace(/^["']|["']$/g, '').trim()
  token = token.replace(/^["']|["']$/g, '').trim().replace(/\s+/g, '')
  if (token.toLowerCase().startsWith('bearer')) token = token.replace(/^bearer/i, '')
  let normalizedUrl = rawUrl.replace(/^libsql:\/\//, 'https://')
  if (normalizedUrl && !normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl
  if (normalizedUrl) {
    try { const urlObj = new URL(normalizedUrl); normalizedUrl = `${urlObj.protocol}//${urlObj.host}` }
    catch (e) { normalizedUrl = normalizedUrl.replace(/\/$/, '') }
  }
  return { rawUrl, token, normalizedUrl }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const { rawUrl, token, normalizedUrl } = getCleanConfig()

  if (req.method === 'GET') {
    let testStatus = 'Not attempted', testDetail = '', dbInfo = {}
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
      } catch (e) { testStatus = 'EXCEPTION'; testDetail = e.message }
    }
    return new Response(JSON.stringify({ ok: !!(normalizedUrl && token), test: testStatus, testDetail, dbInfo, proxy: 'turso-proxy v5' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })
  try {
    const res = await fetch(`${normalizedUrl}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: await req.text()
    })
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
}
