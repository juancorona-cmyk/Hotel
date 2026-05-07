async function pipeline(requests) {
  try {
    const res = await fetch('/.netlify/functions/turso-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(import.meta.env.VITE_TURSO_PROXY_TOKEN || 'change-me-in-production').trim()}`,
      },
      body: JSON.stringify({ requests }),
    })
    
    if (!res.ok) {
      const text = await res.text()
      let errData = {}
      try { errData = JSON.parse(text) } catch {}
      console.error('DB Proxy Error:', res.status, errData)
      throw new Error(errData.error || errData.detail || `Server error ${res.status}`)
    }
    
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data
  } catch (e) {
    console.error('DB Pipeline Failure:', e.message)
    throw e
  }
}

async function exec(sql, args = []) {
  try {
    return await pipeline([
      { type: 'execute', stmt: { sql, args } },
      { type: 'close' },
    ])
  } catch (e) {
    // Re-throw to be caught by UI
    throw e
  }
}

const txt  = (v) => ({ type: 'text',    value: String(v) })
const int  = (v) => ({ type: 'integer', value: String(Math.round(Number(v) || 0)) })
const flt  = (v) => ({ type: 'float',   value: parseFloat(v) || 0 })

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
  const tables = [
    `CREATE TABLE IF NOT EXISTS bot_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type  TEXT NOT NULL,
      session_id  TEXT,
      metadata    TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS admin_users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      hash       TEXT NOT NULL,
      salt       TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS activities (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      fecha      TEXT,
      hora       TEXT,
      active     INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS hotel_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      price       REAL,
      description TEXT,
      date        TEXT,
      capacity    INTEGER,
      active      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS event_registrations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id    INTEGER,
      full_name   TEXT NOT NULL,
      email       TEXT NOT NULL,
      phone       TEXT,
      notes       TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS activity_registrations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id  INTEGER,
      activity_name TEXT,
      full_name    TEXT NOT NULL,
      phone        TEXT NOT NULL,
      how_found    TEXT,
      whatsapp     TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    )`
  ]

  for (const sql of tables) {
    await exec(sql).catch(e => console.warn('Table creation failed (expected if exists):', e.message))
  }

  // migrations: safe to run multiple times
  const migrations = [
    `ALTER TABLE activities ADD COLUMN semanas TEXT DEFAULT 'todas'`,
    `ALTER TABLE hotel_events ADD COLUMN activity_id INTEGER`,
    `ALTER TABLE activity_registrations ADD COLUMN event_id INTEGER`,
    `ALTER TABLE activity_registrations ADD COLUMN event_name TEXT`,
    `ALTER TABLE activity_registrations ADD COLUMN payment_method TEXT DEFAULT NULL`,
    `ALTER TABLE activity_registrations ADD COLUMN paid INTEGER DEFAULT 0`,
    `ALTER TABLE activity_registrations ADD COLUMN paid_at TEXT DEFAULT NULL`,
    `ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'editor'`,
    `ALTER TABLE admin_users ADD COLUMN permissions TEXT DEFAULT NULL`,
    `ALTER TABLE activity_registrations ADD COLUMN checked_in INTEGER DEFAULT 0`,
    `ALTER TABLE activity_registrations ADD COLUMN checked_in_at TEXT DEFAULT NULL`,
    `UPDATE admin_users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM admin_users) AND (role IS NULL OR role = 'editor')`
  ]

  for (const sql of migrations) {
    await exec(sql).catch(() => {}) // Ignore if column already exists
  }
}

// ── Activities ────────────────────────────────────────────
export async function getActivities() {
  const res = await exec(
    'SELECT id, name, fecha, hora, semanas FROM activities WHERE active = 1 ORDER BY id ASC'
  )
  return parseRows(res)
}

export async function saveActivity(name, fecha, hora, semanas = 'todas') {
  const res = await exec(
    'INSERT INTO activities (name, fecha, hora, semanas) VALUES (?, ?, ?, ?)',
    [txt(name), txt(fecha ?? ''), txt(hora ?? ''), txt(semanas)]
  )
  const rawId = res?.results?.[0]?.response?.result?.last_insert_rowid
  return rawId ? Number(rawId) : null
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

export async function linkEventToActivity(eventId, activityId) {
  await exec(
    'UPDATE hotel_events SET activity_id = ? WHERE id = ?',
    [activityId ? int(activityId) : { type: 'null' }, int(eventId)]
  )
}

export async function upsertActivityEvent(activityId, activityName, price, description, date, capacity) {
  const existing = await getEventByActivityId(activityId)
  const slug = activityName.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + '-' + activityId
  if (existing) {
    await exec(
      'UPDATE hotel_events SET name = ?, slug = ?, price = ?, description = ?, date = ?, capacity = ? WHERE id = ?',
      [txt(activityName), txt(slug), flt(price ?? 0), txt(description ?? ''), txt(date ?? ''), int(capacity ?? 0), int(existing.id)]
    )
  } else {
    await exec(
      'INSERT INTO hotel_events (name, slug, price, description, date, capacity, activity_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [txt(activityName), txt(slug), flt(price ?? 0), txt(description ?? ''), txt(date ?? ''), int(capacity ?? 0), int(activityId)]
    )
  }
}

export async function getEventByActivityId(activityId) {
  const res = await exec(
    'SELECT id, name, slug, price, description, date, capacity FROM hotel_events WHERE activity_id = ? AND active = 1 ORDER BY date DESC, created_at DESC LIMIT 1',
    [int(activityId)]
  )
  return parseRows(res)[0] ?? null
}

// ── Activity Registrations ────────────────────────────
export async function createActivityRegistration(activityId, activityName, fullName, phone, howFound, whatsapp, eventId, eventName, paymentMethod) {
  const res = await exec(
    'INSERT INTO activity_registrations (activity_id, activity_name, full_name, phone, how_found, whatsapp, event_id, event_name, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [int(activityId ?? 0), txt(activityName ?? ''), txt(fullName), txt(phone), txt(howFound ?? ''), txt(whatsapp ?? ''), int(eventId ?? 0), txt(eventName ?? ''), txt(paymentMethod ?? '')]
  )
  const rawId = res?.results?.[0]?.response?.result?.last_insert_rowid
  return rawId ? Number(rawId) : null
}

export async function getActivityRegistrations(activityId) {
  const res = await exec(
    'SELECT id, activity_name, full_name, phone, how_found, whatsapp, created_at FROM activity_registrations WHERE activity_id = ? ORDER BY created_at DESC',
    [int(activityId)]
  )
  return parseRows(res)
}

export async function deleteActivityRegistration(id) {
  await exec('DELETE FROM activity_registrations WHERE id = ?', [int(id)])
}

export async function getAllActivityRegistrations() {
  const res = await exec(
    'SELECT id, activity_id, activity_name, event_id, event_name, full_name, phone, how_found, whatsapp, payment_method, paid, paid_at, created_at FROM activity_registrations ORDER BY created_at DESC'
  )
  return parseRows(res)
}

export async function updateActivityRegistrationPayment(id, isPaid) {
  const now = isPaid ? "datetime('now')" : "NULL"
  await exec(
    `UPDATE activity_registrations SET paid = ?, paid_at = ${now} WHERE id = ?`,
    [int(isPaid ? 1 : 0), int(id)]
  )
}

export async function getActivityRegistrationIntents() {
  const res = await exec(
    "SELECT id, session_id, metadata, created_at FROM bot_events WHERE event_type = 'activity_reg_intent' ORDER BY created_at DESC"
  )
  const rows = parseRows(res)
  return rows.map(r => {
    let meta = {}
    try { meta = JSON.parse(r.metadata) } catch {}
    return {
      id: r.id,
      session_id: r.session_id,
      created_at: r.created_at,
      ...meta
    }
  })
}

export async function getHotelReservationEvents() {
  const res = await exec(
    "SELECT id, session_id, event_type, metadata, created_at FROM bot_events WHERE event_type IN ('reserva_click', 'reserva_confirmada') ORDER BY created_at DESC"
  )
  const rows = parseRows(res)
  return rows.map(r => {
    let meta = {}
    try { meta = JSON.parse(r.metadata) } catch {}
    return {
      id: r.id,
      session_id: r.session_id,
      event_type: r.event_type,
      created_at: r.created_at,
      ...meta
    }
  })
}

export async function getRegistrationCountByEvent(eventId) {
  const [r1, r2] = await Promise.all([
    exec('SELECT COUNT(*) as cnt FROM activity_registrations WHERE event_id = ?', [int(eventId)]),
    exec('SELECT COUNT(*) as cnt FROM event_registrations WHERE event_id = ?', [int(eventId)])
  ])
  return Number(parseRows(r1)[0]?.cnt ?? 0) + Number(parseRows(r2)[0]?.cnt ?? 0)
}

export async function deleteEventRegistration(id) {
  await exec('DELETE FROM event_registrations WHERE id = ?', [int(id)])
}

export async function deleteBotEvent(id) {
  await exec('DELETE FROM bot_events WHERE id = ?', [int(id)])
}

// ── Events ────────────────────────────────────────────
export async function getEvents() {
  const res = await exec(
    'SELECT id, name, slug, price, description, date, capacity, active, activity_id FROM hotel_events WHERE active = 1 ORDER BY date DESC, created_at DESC'
  )
  return parseRows(res)
}

export async function getEventBySlug(slug) {
  const res = await exec(
    'SELECT id, name, slug, price, description, date, capacity, activity_id FROM hotel_events WHERE (slug = ? OR slug LIKE ? || \'-%\') AND active = 1 ORDER BY length(slug) ASC LIMIT 1',
    [txt(slug), txt(slug)]
  )
  return parseRows(res)[0] ?? null
}

export async function createEvent(name, slug, price, description, date, capacity, activityId) {
  return exec(
    'INSERT INTO hotel_events (name, slug, price, description, date, capacity, activity_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [txt(name), txt(slug), flt(price ?? 0), txt(description ?? ''), txt(date ?? ''), int(capacity ?? 0), activityId ? int(activityId) : { type: 'null' }]
  )
}

export async function updateEvent(id, name, slug, price, description, date, capacity, activityId) {
  await exec(
    'UPDATE hotel_events SET name = ?, slug = ?, price = ?, description = ?, date = ?, capacity = ?, activity_id = ? WHERE id = ?',
    [txt(name), txt(slug), flt(price ?? 0), txt(description ?? ''), txt(date ?? ''), int(capacity ?? 0), activityId ? int(activityId) : { type: 'null' }, int(id)]
  )
}

export async function deleteEvent(id) {
  await exec('DELETE FROM hotel_events WHERE id = ?', [int(id)])
}

export async function createRegistration(eventId, fullName, email, phone, notes) {
  return exec(
    'INSERT INTO event_registrations (event_id, full_name, email, phone, notes) VALUES (?, ?, ?, ?, ?)',
    [int(eventId), txt(fullName), txt(email), txt(phone ?? ''), txt(notes ?? '')]
  )
}

export async function getRegistrationsByEvent(eventId) {
  const res = await exec(
    'SELECT id, full_name, email, phone, notes, created_at FROM event_registrations WHERE event_id = ? ORDER BY created_at DESC',
    [int(eventId)]
  )
  return parseRows(res)
}

export async function getActivityRegistrationsByEvent(eventId) {
  const res = await exec(
    'SELECT id, full_name, phone, how_found, whatsapp, payment_method, paid, paid_at, created_at FROM activity_registrations WHERE event_id = ? ORDER BY created_at DESC',
    [int(eventId)]
  )
  return parseRows(res)
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
    Object.fromEntries(cols.map((c, i) => {
      const cell = row[i]
      if (!cell || cell.type === 'null') return [c.name, null]
      return [c.name, cell.value ?? cell]
    }))
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
    'SELECT hash, salt, role, permissions FROM admin_users WHERE username = ? LIMIT 1',
    [txt(username)]
  )
  const row = parseRows(res)[0]
  if (!row) return { ok: false }
  const hash = await pbkdf2(password, hexToBytes(row.salt))
  if (hash !== row.hash) return { ok: false }
  let permissions = null
  try { if (row.permissions) permissions = JSON.parse(row.permissions) } catch {}
  return { ok: true, role: row.role ?? 'editor', permissions }
}

export async function adminCreateUser(username, password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const saltHex   = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const hash      = await pbkdf2(password, saltBytes)
  const adminCheck = await exec(`SELECT COUNT(*) as cnt FROM admin_users WHERE role = 'admin'`)
  const hasAdmin = Number(parseRows(adminCheck)[0]?.cnt ?? 0) > 0
  const role = hasAdmin ? 'editor' : 'admin'
  return exec(
    'INSERT OR REPLACE INTO admin_users (username, hash, salt, role) VALUES (?, ?, ?, ?)',
    [txt(username), txt(hash), txt(saltHex), txt(role)]
  )
}

export async function adminGetUsers() {
  const res = await exec(
    'SELECT id, username, created_at, role, permissions FROM admin_users ORDER BY created_at ASC'
  )
  return parseRows(res).map(u => ({
    ...u,
    permissions: u.permissions ? (() => { try { return JSON.parse(u.permissions) } catch { return null } })() : null,
  }))
}

export async function adminSetPermissions(id, permissions) {
  await exec(
    'UPDATE admin_users SET permissions = ? WHERE id = ?',
    [txt(JSON.stringify(permissions)), int(id)]
  )
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

  const [byType, byDayType, sessions, todayByType, yesterdayByType, waSources, reservaSources, confirmaSources, intentSources, regConfirmSources] = await Promise.all([
    exec(`SELECT event_type, COUNT(*) as cnt FROM bot_events WHERE ${pf} GROUP BY event_type ORDER BY cnt DESC`),
    exec(`SELECT date(created_at) as day, event_type, COUNT(*) as cnt FROM bot_events WHERE created_at >= datetime('now', '-13 days') GROUP BY day, event_type ORDER BY day ASC`),
    exec(`SELECT COUNT(DISTINCT session_id) as cnt FROM bot_events WHERE ${pf}`),
    exec(`SELECT event_type, COUNT(*) as cnt FROM bot_events WHERE date(created_at) = date('now') GROUP BY event_type`),
    exec(`SELECT event_type, COUNT(*) as cnt FROM bot_events WHERE date(created_at) = date('now', '-1 day') GROUP BY event_type`),
    exec(`SELECT json_extract(metadata, '$.source') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'whatsapp_click' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT json_extract(metadata, '$.source') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'reserva_click' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT json_extract(metadata, '$.source') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'reserva_confirmada' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT COALESCE(json_extract(metadata, '$.activity_name'), 'General') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'activity_reg_intent' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT COALESCE(json_extract(metadata, '$.activity_name'), 'General') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'activity_reg_confirm' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
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
    intentSources:    parseRows(intentSources),
    regConfirmSources:parseRows(regConfirmSources),
  }
}

export async function clearEvents() {
  await exec('DELETE FROM bot_events')
}

// ── Check-in ────────────────────────────────────────────────
export async function checkInRegistration(id) {
  await exec(
    `UPDATE activity_registrations SET checked_in = 1, checked_in_at = datetime('now') WHERE id = ?`,
    [int(id)]
  )
}

export async function undoCheckInRegistration(id) {
  await exec(
    `UPDATE activity_registrations SET checked_in = 0, checked_in_at = NULL WHERE id = ?`,
    [int(id)]
  )
}

export async function getRegistrationById(id) {
  const res = await exec(
    'SELECT id, activity_id, activity_name, event_id, event_name, full_name, phone, payment_method, paid, checked_in, checked_in_at, created_at FROM activity_registrations WHERE id = ?',
    [int(id)]
  )
  return parseRows(res)[0] ?? null
}
