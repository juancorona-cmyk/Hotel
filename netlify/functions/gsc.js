async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GSC_CLIENT_ID,
      client_secret: process.env.GSC_CLIENT_SECRET,
      refresh_token: process.env.GSC_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`OAuth: ${data.error_description ?? data.error}`)
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
    const { GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN, GOOGLE_SITE_URL } = process.env
    if (!GSC_CLIENT_ID || !GSC_CLIENT_SECRET || !GSC_REFRESH_TOKEN || !GOOGLE_SITE_URL) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'not_configured' }) }
    }

    // Acepta rango explícito (from/to YYYY-MM-DD) o, en su defecto, días desde hoy.
    const qp = event.queryStringParameters ?? {}
    const isYMD = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '')
    let startDate, endDate, days
    if (isYMD(qp.from) && isYMD(qp.to)) {
      startDate = qp.from
      endDate   = qp.to
      days = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1)
    } else {
      days = Math.min(parseInt(qp.days ?? '28'), 90)
      const end = new Date()
      const start = new Date(end)
      start.setDate(start.getDate() - days)
      startDate = start.toISOString().slice(0, 10)
      endDate   = end.toISOString().slice(0, 10)
    }

    const token = await getAccessToken()

    const [totalsRes, byDayRes, byQueryRes] = await Promise.all([
      queryGSC(token, GOOGLE_SITE_URL, { startDate, endDate }),
      queryGSC(token, GOOGLE_SITE_URL, { startDate, endDate, dimensions: ['date'], rowLimit: days }),
      queryGSC(token, GOOGLE_SITE_URL, { startDate, endDate, dimensions: ['query'], rowLimit: 10 }),
    ])

    const apiError = totalsRes.error ?? byDayRes.error ?? byQueryRes.error
    if (apiError) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: `GSC API: ${apiError.message ?? JSON.stringify(apiError)}` }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totals:  totalsRes.rows?.[0] ?? null,
        byDay:   byDayRes.rows   ?? [],
        byQuery: byQueryRes.rows ?? [],
        period:  { startDate, endDate, days },
      }),
    }
  } catch (err) {
    console.error(err)
    const isTokenError = /expired|revoked|invalid_grant/i.test(err.message)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: isTokenError ? 'token_expired' : err.message }),
    }
  }
}
