const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getTurso() {
  let url = (process.env.TURSO_URL || '').trim().replace(/^libsql:\/\//, 'https://')
  const token = (process.env.TURSO_TOKEN || '').trim()
  try { const u = new URL(url); url = `${u.protocol}//${u.host}` } catch {}
  return { url, token }
}

async function tursoExec(sql, args = []) {
  const { url, token } = getTurso()
  const res = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args } }, { type: 'close' }] }),
  })
  if (!res.ok) throw new Error(`Turso error ${res.status}`)
  return res.json()
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const body = await req.json()

    // FCM native token (from @capacitor/push-notifications)
    if (body.fcmToken) {
      await tursoExec(`CREATE TABLE IF NOT EXISTS fcm_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
      )`)
      await tursoExec(
        'INSERT OR REPLACE INTO fcm_tokens (token) VALUES (?)',
        [{ type: 'text', value: body.fcmToken }]
      )
      return new Response(JSON.stringify({ ok: true, type: 'fcm' }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Web Push subscription (browser)
    const { endpoint, keys } = body
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    await tursoExec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
    await tursoExec(
      'INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)',
      [{ type: 'text', value: endpoint }, { type: 'text', value: keys.p256dh }, { type: 'text', value: keys.auth }]
    )
    return new Response(JSON.stringify({ ok: true, type: 'webpush' }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[push-subscribe]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
}
