import crypto from 'crypto'

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

function b64url(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data)
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url({ alg: 'RS256', typ: 'JWT' })
  const payload = b64url({
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  })
  const unsigned = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(unsigned)
  const sig = sign.sign(sa.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const jwt = `${unsigned}.${sig}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Auth: ${data.error_description ?? data.error}`)
  return data.access_token
}

async function queryGSC(token, siteUrl, body) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export const handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers }

  try {
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    const siteUrl = process.env.GOOGLE_SITE_URL
    if (!saJson || !siteUrl) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'not_configured' }) }
    }

    const sa = JSON.parse(saJson)
    const days = Math.min(parseInt(event.queryStringParameters?.days ?? '28'), 90)
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - days)
    const startDate = start.toISOString().slice(0, 10)
    const endDate = end.toISOString().slice(0, 10)

    const token = await getAccessToken(sa)

    const [totalsRes, byDayRes, byQueryRes] = await Promise.all([
      queryGSC(token, siteUrl, { startDate, endDate }),
      queryGSC(token, siteUrl, { startDate, endDate, dimensions: ['date'], rowLimit: days }),
      queryGSC(token, siteUrl, { startDate, endDate, dimensions: ['query'], rowLimit: 10 }),
    ])

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totals: totalsRes.rows?.[0] ?? null,
        byDay: byDayRes.rows ?? [],
        byQuery: byQueryRes.rows ?? [],
        period: { startDate, endDate, days },
      }),
    }
  } catch (err) {
    console.error(err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
