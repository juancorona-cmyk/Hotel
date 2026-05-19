import webpush from 'web-push'
import { createSign } from 'crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// ── Turso helpers ─────────────────────────────────────────
function getTurso() {
  let url = (process.env.TURSO_URL || '').trim().replace(/^libsql:\/\//, 'https://')
  const token = (process.env.TURSO_TOKEN || '').trim()
  try { const u = new URL(url); url = `${u.protocol}//${u.host}` } catch {}
  return { url, token }
}

async function tursoQuery(sql) {
  const { url, token } = getTurso()
  try {
    const res = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }] }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const rows = data?.results?.[0]?.response?.result?.rows ?? []
    return rows.map(row => row.map(cell => cell?.value ?? cell))
  } catch { return [] }
}

async function tursoDelete(table, col, value) {
  const { url, token } = getTurso()
  await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [
      { type: 'execute', stmt: { sql: `DELETE FROM ${table} WHERE ${col} = ?`, args: [{ type: 'text', value }] } },
      { type: 'close' }
    ] }),
  }).catch(() => {})
}

// ── FCM v1 API (JWT auth, no external packages) ───────────
async function getFCMAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')
  const unsigned = `${header}.${claim}`
  const sign = createSign('RSA-SHA256')
  sign.update(unsigned)
  const sig = sign.sign(sa.private_key, 'base64url')
  const jwt = `${unsigned}.${sig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`FCM auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

async function sendFCM(token, title, body, data, accessToken, projectId) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])),
          android: {
            priority: 'high',
            ttl: '60s',
            notification: {
              channel_id: 'hotel_push',
              notification_priority: 'PRIORITY_HIGH',
              visibility: 'VISIBILITY_PUBLIC',
              default_vibrate_timings: true,
              default_light_settings: true,
            },
          },
        },
      }),
    }
  )
  return res
}

// ── Main handler ──────────────────────────────────────────
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const body = await req.json()
    const title = body.title || 'Hotel Punta Galería'
    const msgBody = body.body || 'Nuevo registro recibido'
    const url = body.url || 'https://hotelpuntagaleria.mx/checkin'
    const tag = body.tag || 'hotel-notif'
    const regId = body.regId || ''

    let fcmSent = 0, webSent = 0

    // ── FCM: native Android push ──────────────────────────
    const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT
    const projectId = process.env.FIREBASE_PROJECT_ID
    if (saRaw && projectId) {
      try {
        const sa = JSON.parse(saRaw)
        const accessToken = await getFCMAccessToken(sa)
        const tokens = await tursoQuery('SELECT token FROM fcm_tokens')
        const stale = []
        await Promise.allSettled(tokens.map(async ([tok]) => {
          const r = await sendFCM(tok, title, msgBody, { url, tag, regId: String(regId) }, accessToken, projectId)
          if (r.status === 404 || r.status === 410) stale.push(tok)
          else if (r.ok) fcmSent++
        }))
        await Promise.allSettled(stale.map(tok => tursoDelete('fcm_tokens', 'token', tok)))
      } catch (e) {
        console.warn('[push-notify] FCM error:', e.message)
      }
    }

    // ── Web Push: browser push ─────────────────────────────
    const vapidPublic = process.env.VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails('mailto:info@hotelpuntagaleria.mx', vapidPublic, vapidPrivate)
      const payload = JSON.stringify({ title, body: msgBody, url, tag, regId })
      const subs = await tursoQuery('SELECT endpoint, p256dh, auth FROM push_subscriptions')
      const stale = []
      await Promise.allSettled(subs.map(async ([endpoint, p256dh, auth]) => {
        try {
          await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload)
          webSent++
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) stale.push(endpoint)
        }
      }))
      await Promise.allSettled(stale.map(ep => tursoDelete('push_subscriptions', 'endpoint', ep)))
    }

    return new Response(JSON.stringify({ ok: true, fcm: fcmSent, web: webSent }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[push-notify]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
}
