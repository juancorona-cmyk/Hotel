import { pbkdf2, createHmac, timingSafeEqual, randomBytes } from 'crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Rate limiter: max 10 login attempts per IP per 15 minutes
const limiter = new Map()
function checkLimit(ip) {
  const now = Date.now()
  const WINDOW = 15 * 60 * 1000
  const MAX = 10
  const key = ip || 'unknown'
  const entry = limiter.get(key)
  if (!entry || now > entry.reset) {
    limiter.set(key, { count: 1, reset: now + WINDOW })
    return false
  }
  if (entry.count >= MAX) return true
  entry.count++
  return false
}

// JWT (HMAC-SHA256) — no external dependencies
function b64url(data) {
  return Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)).toString('base64url')
}

function signJWT(payload, secret) {
  const h = b64url({ alg: 'HS256', typ: 'JWT' })
  const p = b64url(payload)
  const sig = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${sig}`
}

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

function getDB() {
  let url = (process.env.TURSO_URL || process.env.VITE_TURSO_URL || '').trim()
    .replace(/^["']|["']$/g, '').replace(/^libsql:\/\//, 'https://')
  if (url && !url.startsWith('http')) url = 'https://' + url
  try { const u = new URL(url); url = `${u.protocol}//${u.host}` } catch {}
  const token = (process.env.TURSO_TOKEN || process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_TOKEN || '')
    .trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '').replace(/^bearer /i, '')
  return { url, token }
}

async function dbQuery(sql, args = []) {
  const { url, token } = getDB()
  const res = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args } }, { type: 'close' }] }),
  })
  const data = await res.json()
  const rows = data?.results?.[0]?.response?.result?.rows ?? []
  const cols  = data?.results?.[0]?.response?.result?.cols ?? []
  return rows.map(row => Object.fromEntries(cols.map((c, i) => {
    const cell = row[i]
    return [c.name, (!cell || cell.type === 'null') ? null : (cell.value ?? cell)]
  })))
}

// Politica de contraseña server-side: 8+, sin espacios, letra + numero.
function validatePassword(pwd = '') {
  const p = String(pwd)
  if (p.length < 8) return 'Mínimo 8 caracteres'
  if (/\s/.test(p)) return 'Sin espacios'
  if (/^\d+$/.test(p)) return 'No puede ser solo números'
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Combina letras y números'
  return null
}

function hashPassword(password, saltHex) {
  return new Promise((resolve, reject) => {
    pbkdf2(password, Buffer.from(saltHex, 'hex'), 100000, 32, 'sha256',
      (err, key) => err ? reject(err) : resolve(key.toString('hex'))
    )
  })
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  const secret = process.env.ADMIN_JWT_SECRET
  if (!secret) return json({ ok: false, error: 'Configuración del servidor incompleta (ADMIN_JWT_SECRET)' }, 500)

  try {
    const body = await req.json()
    const { action, username, password, token: clientToken } = body

    // ── Verify token ──────────────────────────────────────────────────────────
    if (action === 'verify') {
      if (!clientToken) return json({ ok: false, error: 'Token requerido' }, 400)
      const payload = verifyJWT(clientToken, secret)
      if (!payload) return json({ ok: false, reason: 'invalid' }, 401)
      return json({
        ok: true,
        username: payload.sub,
        role: payload.role,
        permissions: payload.permissions ?? null,
        setup: payload.setup ?? false,
      })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-nf-client-connection-ip')
      || null

    // ── Recuperar contraseña (valida la clave de recuperacion server-side) ──────
    if (action === 'reset') {
      if (checkLimit(ip)) return json({ ok: false, error: 'Demasiados intentos. Espera 15 minutos.' }, 429)
      const { newPassword, setupKey } = body
      const sk = process.env.ADMIN_SETUP_KEY
      if (!sk || setupKey !== sk) return json({ ok: false, error: 'Clave de recuperación incorrecta' }, 401)
      if (!username?.trim() || !newPassword || String(newPassword).length < 8) {
        return json({ ok: false, error: 'Datos inválidos' }, 400)
      }
      const [u] = await dbQuery('SELECT id FROM admin_users WHERE username = ? LIMIT 1', [{ type: 'text', value: username.trim() }])
      if (!u) return json({ ok: false, error: 'El usuario no existe' }, 404)
      const salt = randomBytes(16).toString('hex')
      const hash = await hashPassword(newPassword, salt)
      await dbQuery('UPDATE admin_users SET hash = ?, salt = ? WHERE username = ?', [
        { type: 'text', value: hash }, { type: 'text', value: salt }, { type: 'text', value: username.trim() },
      ])
      return json({ ok: true })
    }

    // ── Cambio forzado de contraseña (clave generica → nueva) ──────────────────
    if (action === 'change') {
      if (checkLimit(ip)) return json({ ok: false, error: 'Demasiados intentos. Espera 15 minutos.' }, 429)
      const { newPassword } = body
      if (!username?.trim() || !password) return json({ ok: false, error: 'Credenciales requeridas' }, 400)
      const msg = validatePassword(newPassword)
      if (msg) return json({ ok: false, error: msg }, 400)
      if (newPassword === password) return json({ ok: false, error: 'La nueva contraseña debe ser distinta' }, 400)

      const [u] = await dbQuery(
        'SELECT hash, salt, role, permissions FROM admin_users WHERE username = ? LIMIT 1',
        [{ type: 'text', value: username.trim() }]
      )
      if (!u) return json({ ok: false, reason: 'not_found' })
      const curHash = await hashPassword(password, u.salt)
      if (curHash !== u.hash) return json({ ok: false, reason: 'bad_password' })

      const salt = randomBytes(16).toString('hex')
      const hash = await hashPassword(newPassword, salt)
      await dbQuery('UPDATE admin_users SET hash = ?, salt = ?, must_change = 0 WHERE username = ?', [
        { type: 'text', value: hash }, { type: 'text', value: salt }, { type: 'text', value: username.trim() },
      ])

      let permissions = null
      try { if (u.permissions) permissions = JSON.parse(u.permissions) } catch {}
      const now = Math.floor(Date.now() / 1000)
      const token = signJWT({
        sub: username.trim(), role: u.role ?? 'admin', permissions,
        iat: now, exp: now + 8 * 3600,
      }, secret)
      return json({ ok: true, token })
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    if (!username?.trim() || !password) return json({ ok: false, error: 'Credenciales requeridas' }, 400)

    if (checkLimit(ip)) return json({ ok: false, error: 'Demasiados intentos. Espera 15 minutos.' }, 429)

    const [countRow] = await dbQuery('SELECT COUNT(*) as cnt FROM admin_users')
    const userCount = Number(countRow?.cnt ?? 0)

    if (userCount === 0) {
      const sk = process.env.ADMIN_SETUP_KEY
      if (sk && password === sk) {
        const now = Math.floor(Date.now() / 1000)
        const token = signJWT({
          sub: username.trim(), role: 'admin', permissions: null, setup: true,
          iat: now, exp: now + 8 * 3600,
        }, secret)
        return json({ ok: true, token, setup: true })
      }
      return json({ ok: false, reason: 'setup' })
    }

    const [row] = await dbQuery(
      'SELECT hash, salt, role, permissions, must_change FROM admin_users WHERE username = ? LIMIT 1',
      [{ type: 'text', value: username.trim() }]
    )

    if (!row) return json({ ok: false, reason: 'not_found' })

    const hash = await hashPassword(password, row.salt)
    if (hash !== row.hash) return json({ ok: false, reason: 'bad_password' })

    // Clave generica: forzar cambio antes de entrar
    if (Number(row.must_change) === 1) return json({ ok: false, reason: 'must_change' })

    let permissions = null
    try { if (row.permissions) permissions = JSON.parse(row.permissions) } catch {}

    const now = Math.floor(Date.now() / 1000)
    const token = signJWT({
      sub: username.trim(), role: row.role ?? 'admin', permissions,
      iat: now, exp: now + 8 * 3600,
    }, secret)

    return json({ ok: true, token })
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}
