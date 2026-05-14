import { pbkdf2 } from 'crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

  try {
    const { username, password, setupKey } = await req.json()
    if (!username?.trim() || !password) return json({ ok: false, error: 'Credenciales requeridas' }, 400)

    const [countRow] = await dbQuery('SELECT COUNT(*) as cnt FROM admin_users')
    const userCount = Number(countRow?.cnt ?? 0)

    if (userCount === 0) {
      const sk = process.env.VITE_ADMIN_SETUP_KEY || process.env.ADMIN_SETUP_KEY
      if ((sk && password === sk) || (setupKey && password === setupKey)) {
        return json({ ok: true, role: 'admin', permissions: null })
      }
      return json({ ok: false, reason: 'setup' })
    }

    const [row] = await dbQuery(
      'SELECT hash, salt, role, permissions FROM admin_users WHERE username = ? LIMIT 1',
      [{ type: 'text', value: username.trim() }]
    )

    if (!row) return json({ ok: false, reason: 'not_found' })

    const hash = await hashPassword(password, row.salt)
    if (hash !== row.hash) return json({ ok: false, reason: 'bad_password' })

    let permissions = null
    try { if (row.permissions) permissions = JSON.parse(row.permissions) } catch {}
    return json({ ok: true, role: row.role ?? 'admin', permissions })
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}
