import webpush from 'web-push'
import { GoogleAuth } from 'google-auth-library'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  } catch (e) {
    console.error('[turso]', e.message)
    return []
  }
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

// ── FCM v1 via google-auth-library ────────────────────────
function parseSA(raw) {
  // Manejar tanto JSON de una línea como multi-línea
  try { return JSON.parse(raw) } catch {}
  // Fallback: escapar newlines literales dentro de valores de string
  const fixed = raw.replace(/("(?:[^"\\]|\\.)*")/g, m =>
    m.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  )
  return JSON.parse(fixed)
}

let _authClient = null
async function getFCMToken() {
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!saRaw) throw new Error('FIREBASE_SERVICE_ACCOUNT no configurado en Netlify')
  const sa = parseSA(saRaw)
  if (!_authClient) {
    const auth = new GoogleAuth({
      credentials: sa,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    })
    _authClient = await auth.getClient()
  }
  const { token } = await _authClient.getAccessToken()
  return token
}

async function sendFCM(fcmToken, title, body, data, projectId) {
  const accessToken = await getFCMToken()
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          // Data-only: FCM siempre llama a onMessageReceived sin importar el estado de la app.
          // HotelMessagingService.java construye y muestra la notificación del sistema.
          data: {
            title,
            body,
            ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])),
          },
          android: {
            priority: 'high',
            ttl: '86400s',
          },
        },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    console.error(`[FCM] token error ${res.status}:`, err.slice(0, 300))
  }
  return res
}

// ── Main handler ──────────────────────────────────────────
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // GET — diagnóstico: verifica config y cuenta tokens
  if (req.method === 'GET') {
    const saSet = !!process.env.FIREBASE_SERVICE_ACCOUNT
    const pidSet = !!process.env.FIREBASE_PROJECT_ID
    const vapidSet = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    const fcmTokens = await tursoQuery('SELECT COUNT(*) FROM fcm_tokens').then(r => Number(r?.[0]?.[0] ?? 0)).catch(() => 0)
    const webSubs = await tursoQuery('SELECT COUNT(*) FROM push_subscriptions').then(r => Number(r?.[0]?.[0] ?? 0)).catch(() => 0)

    let fcmAuthOk = false
    let fcmAuthErr = null
    if (saSet && pidSet) {
      try { await getFCMToken(); fcmAuthOk = true } catch (e) { fcmAuthErr = e.message }
    }

    return new Response(JSON.stringify({
      env: { FIREBASE_SERVICE_ACCOUNT: saSet, FIREBASE_PROJECT_ID: pidSet, VAPID: vapidSet },
      db: { fcmTokens, webSubs },
      fcmAuth: fcmAuthOk ? 'OK' : (fcmAuthErr || 'not tested'),
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const body = await req.json()
    const title = body.title || 'Hotel Punta Galería'
    const msgBody = body.body || 'Nuevo registro recibido'
    const url = body.url || 'https://hotelpuntagaleria.mx/checkin'
    const tag = body.tag || 'hotel-notif'
    const regId = body.regId || ''

    let fcmSent = 0, fcmErrors = 0, webSent = 0
    const projectId = process.env.FIREBASE_PROJECT_ID

    // ── FCM ───────────────────────────────────────────────
    if (projectId && process.env.FIREBASE_SERVICE_ACCOUNT) {
      const tokens = await tursoQuery('SELECT token FROM fcm_tokens')
      console.log(`[push-notify] FCM tokens en DB: ${tokens.length}`)
      const stale = []
      await Promise.allSettled(tokens.map(async ([tok]) => {
        try {
          const r = await sendFCM(tok, title, msgBody, { url, tag, regId: String(regId) }, projectId)
          if (r.status === 404 || r.status === 410) stale.push(tok)
          else if (r.ok) fcmSent++
          else fcmErrors++
        } catch (e) {
          console.error('[push-notify] FCM send error:', e.message)
          fcmErrors++
        }
      }))
      await Promise.allSettled(stale.map(tok => tursoDelete('fcm_tokens', 'token', tok)))
    } else {
      console.warn('[push-notify] FIREBASE_SERVICE_ACCOUNT o FIREBASE_PROJECT_ID no configurados')
    }

    // ── Web Push ──────────────────────────────────────────
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails('mailto:info@hotelpuntagaleria.mx', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
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

    console.log(`[push-notify] fcm=${fcmSent} errors=${fcmErrors} web=${webSent}`)
    return new Response(JSON.stringify({ ok: true, fcm: fcmSent, fcmErrors, web: webSent }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[push-notify] fatal:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
}
