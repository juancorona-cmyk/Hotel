const BASE = import.meta.env.VITE_TURSO_URL
const TOKEN = import.meta.env.VITE_TURSO_TOKEN

async function pipeline(requests) {
  try {
    const res = await fetch(`${BASE}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function exec(sql, args = []) {
  return pipeline([
    { type: 'execute', stmt: { sql, args } },
    { type: 'close' },
  ])
}

const txt = (v) => ({ type: 'text', value: String(v) })
const int = (v) => ({ type: 'integer', value: String(v) })

// ── Session ──────────────────────────────────────────────
let _sid = null
function getSession() {
  if (_sid) return _sid
  _sid = sessionStorage.getItem('hb_sid')
  if (!_sid) {
    _sid = Math.random().toString(36).slice(2, 11)
    sessionStorage.setItem('hb_sid', _sid)
  }
  return _sid
}

// ── Setup ────────────────────────────────────────────────
export async function setupDB() {
  await Promise.all([
    exec(`
      CREATE TABLE IF NOT EXISTS bot_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type  TEXT NOT NULL,
        session_id  TEXT,
        metadata    TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
      )
    `),
    exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        username   TEXT NOT NULL UNIQUE,
        hash       TEXT NOT NULL,
        salt       TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `),
    exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        fecha      TEXT,
        hora       TEXT,
        active     INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `),
  ])
  // migration: safe to run multiple times, SQLite ignores if column exists
  await exec(`ALTER TABLE activities ADD COLUMN semanas TEXT DEFAULT 'todas'`).catch(() => {})
}

// ── Activities ────────────────────────────────────────────
export async function getActivities() {
  const res = await exec(
    'SELECT id, name, fecha, hora, semanas FROM activities WHERE active = 1 ORDER BY id ASC'
  )
  return parseRows(res)
}

export async function saveActivity(name, fecha, hora, semanas = 'todas') {
  return exec(
    'INSERT INTO activities (name, fecha, hora, semanas) VALUES (?, ?, ?, ?)',
    [txt(name), txt(fecha ?? ''), txt(hora ?? ''), txt(semanas)]
  )
}

export async function deleteActivity(id) {
  await exec('DELETE FROM activities WHERE id = ?', [int(id)])
}

export async function updateActivity(id, name, fecha, hora, semanas) {
  await exec(
    'UPDATE activities SET name = ?, fecha = ?, hora = ?, semanas = ? WHERE id = ?',
    [txt(name), txt(fecha ?? ''), txt(hora ?? ''), txt(semanas ?? 'todas'), int(id)]
  )
}

// ── Track ────────────────────────────────────────────────
export function trackEvent(eventType, metadata = {}) {
  exec(
    'INSERT INTO bot_events (event_type, session_id, metadata) VALUES (?, ?, ?)',
    [txt(eventType), txt(getSession()), txt(JSON.stringify(metadata))]
  )
}

// ── Parse ────────────────────────────────────────────────
function parseRows(result) {
  const rows = result?.results?.[0]?.response?.result?.rows ?? []
  const cols = result?.results?.[0]?.response?.result?.cols ?? []
  return rows.map(row =>
    Object.fromEntries(cols.map((c, i) => [c.name, row[i]?.value ?? row[i]]))
  )
}

// ── PBKDF2 (Web Crypto) ───────────────────────────────────
async function pbkdf2(password, saltBytes) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    key, 256
  )
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16)))
}

// ── Admin users ───────────────────────────────────────────
export async function adminHasUsers() {
  const res = await exec('SELECT COUNT(*) as cnt FROM admin_users')
  return Number(parseRows(res)[0]?.cnt ?? 0) > 0
}

export async function adminLogin(username, password) {
  const res = await exec(
    'SELECT hash, salt FROM admin_users WHERE username = ? LIMIT 1',
    [txt(username)]
  )
  const row = parseRows(res)[0]
  if (!row) return false
  const hash = await pbkdf2(password, hexToBytes(row.salt))
  return hash === row.hash
}

export async function adminCreateUser(username, password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const saltHex   = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const hash      = await pbkdf2(password, saltBytes)
  return exec(
    'INSERT OR REPLACE INTO admin_users (username, hash, salt) VALUES (?, ?, ?)',
    [txt(username), txt(hash), txt(saltHex)]
  )
}

export async function adminGetUsers() {
  const res = await exec(
    'SELECT id, username, created_at FROM admin_users ORDER BY created_at ASC'
  )
  return parseRows(res)
}

export async function adminDeleteUser(id) {
  await exec('DELETE FROM admin_users WHERE id = ?', [int(id)])
}

export async function adminChangePassword(username, newPassword) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const saltHex   = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const hash      = await pbkdf2(newPassword, saltBytes)
  await exec(
    'UPDATE admin_users SET hash = ?, salt = ? WHERE username = ?',
    [txt(hash), txt(saltHex), txt(username)]
  )
}

// ── Stats ────────────────────────────────────────────────
export async function getStats(days = 28) {
  const pf = days > 0 ? `created_at >= datetime('now', '-${days} days')` : '1=1'

  const [byType, byDayType, sessions, todayByType, yesterdayByType, waSources, reservaSources, confirmaSources] = await Promise.all([
    exec(`SELECT event_type, COUNT(*) as cnt FROM bot_events WHERE ${pf} GROUP BY event_type ORDER BY cnt DESC`),
    exec(`SELECT date(created_at) as day, event_type, COUNT(*) as cnt FROM bot_events WHERE created_at >= datetime('now', '-13 days') GROUP BY day, event_type ORDER BY day ASC`),
    exec(`SELECT COUNT(DISTINCT session_id) as cnt FROM bot_events WHERE ${pf}`),
    exec(`SELECT event_type, COUNT(*) as cnt FROM bot_events WHERE date(created_at) = date('now') GROUP BY event_type`),
    exec(`SELECT event_type, COUNT(*) as cnt FROM bot_events WHERE date(created_at) = date('now', '-1 day') GROUP BY event_type`),
    exec(`SELECT json_extract(metadata, '$.source') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'whatsapp_click' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT json_extract(metadata, '$.source') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'reserva_click' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT json_extract(metadata, '$.source') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'reserva_confirmada' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
  ])

  return {
    byType:           parseRows(byType),
    byDayType:        parseRows(byDayType),
    sessions:         Number(parseRows(sessions)[0]?.cnt ?? 0),
    todayByType:      parseRows(todayByType),
    yesterdayByType:  parseRows(yesterdayByType),
    waSources:        parseRows(waSources),
    reservaSources:   parseRows(reservaSources),
    confirmaSources:  parseRows(confirmaSources),
  }
}

export async function clearEvents() {
  await exec('DELETE FROM bot_events')
}
