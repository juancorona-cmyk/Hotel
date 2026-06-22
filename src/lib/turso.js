import { Capacitor } from '@capacitor/core'

// Auto-detección de API_BASE:
// 1. En local dev (browser): '' (usa el proxy de Vite)
// 2. En Live Reload (Capacitor con puerto): '' (usa el proxy de Vite via adb reverse)
// 3. En Producción APK o Native sin dev server: 'https://hotelpuntagaleria.mx'
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const isLiveReload = isLocalDev && window.location.port !== ''

const API_BASE = (Capacitor.isNativePlatform() && !isLiveReload)
  ? 'https://hotelpuntagaleria.mx'
  : ''

export { API_BASE }

export async function getProxyConfig() {
  const url = `${API_BASE}/.netlify/functions/turso-proxy`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const text = await res.text()
    if (text.trim().startsWith('<')) return null 
    return JSON.parse(text)
  } catch (err) {
    console.warn(`[getProxyConfig] Failed to fetch from ${url}:`, err)
    return null
  }
}

async function pipeline(requests) {
  const url = `${API_BASE}/.netlify/functions/turso-proxy`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    // Adjunta el token admin para operaciones protegidas (admin_users).
    // App nativa guarda en localStorage.ci_token; dashboard en sessionStorage.adm_token.
    try {
      let t = null
      try { t = localStorage.getItem('ci_token') } catch {}
      if (!t) { try { t = sessionStorage.getItem('adm_token') } catch {} }
      if (t) headers.Authorization = `Bearer ${t}`
    } catch {}

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests }),
      signal: controller.signal,
    })

    const text = await res.text()

    if (text.trim().startsWith('<')) {
      throw new Error(`El servidor devolvió HTML (posible error 404 o 500). Verifica la URL: ${url}`)
    }

    if (!res.ok) {
      let errData = {}
      try { errData = JSON.parse(text) } catch {}
      throw new Error(errData.error || errData.detail || `Error del servidor ${res.status} en ${url}`)
    }

    const data = JSON.parse(text)
    if (data.error) throw new Error(data.error)
    return data
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Tiempo de espera agotado (15s) al conectar con: ${url}`)
    if (e.message.toLowerCase().includes('failed to fetch') || e.message.toLowerCase().includes('network')) {
      throw new Error(`Sin conexión al servidor (${url}). Verifica tu internet o el estado del servidor.`)
    }
    throw e
  } finally {
    clearTimeout(timer)
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
    )`,
    `CREATE TABLE IF NOT EXISTS whatsapp_members (
      phone TEXT PRIMARY KEY
    )`,
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS fcm_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
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
    `ALTER TABLE admin_users ADD COLUMN must_change INTEGER DEFAULT 0`,
    `ALTER TABLE activity_registrations ADD COLUMN checked_in INTEGER DEFAULT 0`,
    `ALTER TABLE activity_registrations ADD COLUMN checked_in_at TEXT DEFAULT NULL`,
    `ALTER TABLE activity_registrations ADD COLUMN transfer_proof_url TEXT DEFAULT NULL`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4431288388')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4431103910')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4431276964')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4431439249')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4431615116')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4431747144')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4431889947')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4432271719')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4432250723')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4433547618')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4433575848')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4433722947')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4433834137')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4434039154')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4434445952')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4434768462')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4434838808')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4435047933')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4435350722')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4436951877')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4437234585')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4438012099')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4438668200')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4522026766')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('5547866332')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('7551019334')`,
    `INSERT OR IGNORE INTO whatsapp_members (phone) VALUES ('4439379301')`
  ]

  for (const sql of migrations) {
    await exec(sql).catch(() => {}) // Ignore if column already exists
  }
}

// ── WhatsApp Members ──────────────────────────────────────
export async function checkWhatsappMember(phone) {
  const digits = phone.replace(/[\s\-().+]/g, '')
  const normalized = digits.length > 10 ? digits.slice(-10) : digits
  const res = await exec('SELECT 1 FROM whatsapp_members WHERE phone = ? LIMIT 1', [txt(normalized)])
  return parseRows(res).length > 0
}

export async function addWhatsappMember(phone) {
  const digits = phone.replace(/[\s\-().+]/g, '')
  const normalized = digits.length > 10 ? digits.slice(-10) : digits
  await exec('INSERT OR IGNORE INTO whatsapp_members (phone) VALUES (?)', [txt(normalized)])
}

export async function checkExistingRegistration(phone, eventId) {
  const digits = phone.replace(/[\s\-().+]/g, '')
  const normalized = digits.length > 10 ? digits.slice(-10) : digits
  // Normalize stored phone in SQL to handle spaces/dashes/country codes in existing records
  const res = await exec(
    `SELECT id, full_name FROM activity_registrations
     WHERE SUBSTR(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'(',''),')',''),'+',''), -10) = ?
     AND event_id = ? LIMIT 1`,
    [txt(normalized), int(eventId)]
  )
  return parseRows(res)[0] ?? null
}

// ── Activities ────────────────────────────────────────────
export async function getActivities() {
  const res = await exec(
    `SELECT a.id, a.name, a.fecha, a.hora, a.semanas
     FROM activities a
     INNER JOIN hotel_events e ON e.activity_id = a.id AND e.active = 1
     WHERE a.active = 1
     ORDER BY a.id ASC`
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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
  return slug
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
    'SELECT id, activity_id, activity_name, event_id, event_name, full_name, phone, how_found, whatsapp, payment_method, paid, paid_at, checked_in, checked_in_at, created_at FROM activity_registrations ORDER BY created_at DESC'
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
  const res = await exec('SELECT COUNT(*) as cnt FROM activity_registrations WHERE event_id = ?', [int(eventId)])
  return Number(parseRows(res)[0]?.cnt ?? 0)
}

// @legacy — la tabla event_registrations ya no recibe escrituras del frontend
export async function deleteEventRegistration(id) {
  await exec('DELETE FROM event_registrations WHERE id = ?', [int(id)])
}

export async function deleteBotEvent(id) {
  await exec('DELETE FROM bot_events WHERE id = ?', [int(id)])
}

// ── Events ────────────────────────────────────────────
export async function getEvents() {
  const res = await exec(
    'SELECT e.id, e.name, e.slug, e.price, e.description, e.date, e.capacity, e.active, e.activity_id, a.hora FROM hotel_events e LEFT JOIN activities a ON e.activity_id = a.id WHERE e.active = 1 ORDER BY e.date DESC, e.created_at DESC'
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

export async function closeEvent(id) {
  await exec('UPDATE hotel_events SET active = 0 WHERE id = ?', [int(id)])
  await exec(
    'UPDATE activities SET active = 0 WHERE id = (SELECT activity_id FROM hotel_events WHERE id = ?)',
    [int(id)]
  )
}

export async function copyEventRegistrations(oldEventId, newEventId, newEventName, activityId) {
  await exec(
    `INSERT INTO activity_registrations (activity_id, activity_name, event_id, event_name, full_name, phone, how_found, whatsapp, paid, checked_in)
     SELECT ?, ?, ?, ?, full_name, phone, how_found, whatsapp, 0, 0
     FROM activity_registrations WHERE event_id = ?`,
    [int(activityId ?? 0), txt(newEventName), int(newEventId), txt(newEventName), int(oldEventId)]
  )
}

export async function getArchivedEvents() {
  const res = await exec(
    'SELECT e.id, e.name, e.slug, e.price, e.description, e.date, e.capacity, e.active, e.activity_id, a.hora FROM hotel_events e LEFT JOIN activities a ON e.activity_id = a.id WHERE e.active = 0 ORDER BY e.date DESC, e.created_at DESC'
  )
  return parseRows(res)
}

// @legacy — la tabla event_registrations ya no recibe escrituras del frontend
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
    'SELECT id, full_name, phone, how_found, whatsapp, payment_method, paid, paid_at, checked_in, checked_in_at, transfer_proof_url, created_at FROM activity_registrations WHERE event_id = ? ORDER BY created_at DESC',
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

// Login via servidor — PBKDF2 ocurre en el servidor; el hash nunca llega al browser
export async function adminLoginSingle(username, password) {
  const url = `${API_BASE}/.netlify/functions/auth`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error(`Respuesta inválida del servidor en ${url}`) }
    if (!res.ok && res.status !== 401 && res.status !== 429) throw new Error(data.error || `Error ${res.status} en ${url}`)
    return data
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Tiempo de espera agotado (15s) al conectar con: ${url}`)
    if (e.message.toLowerCase().includes('failed to fetch') || e.message.toLowerCase().includes('network')) {
      throw new Error(`Sin conexión al servidor (${url}). Verifica tu internet o el estado del servidor.`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// Verifica un JWT de sesión con el servidor
export async function adminVerifyToken(token) {
  const url = `${API_BASE}/.netlify/functions/auth`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token }),
    })
    return res.json()
  } catch { return { ok: false } }
}

export async function adminCreateUser(username, password, role = 'editor', mustChange = false) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const saltHex   = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const hash      = await pbkdf2(password, saltBytes)

  // For staff, set limited default permissions
  let permissions = null
  if (role === 'staff') {
    permissions = JSON.stringify({ checkin: true, inscripciones: true })
  }

  return exec(
    'INSERT OR REPLACE INTO admin_users (username, hash, salt, role, permissions, must_change) VALUES (?, ?, ?, ?, ?, ?)',
    [txt(username), txt(hash), txt(saltHex), txt(role), permissions ? txt(permissions) : { type: 'null' }, int(mustChange ? 1 : 0)]
  )
}

// Cambio forzado de contraseña en primer ingreso (clave generica → nueva)
export async function adminForceChangePassword(username, currentPassword, newPassword) {
  const url = `${API_BASE}/.netlify/functions/auth`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ action: 'change', username, password: currentPassword, newPassword }),
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { throw new Error(`Respuesta inválida del servidor en ${url}`) }
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

export async function adminChangePassword(username, newPassword, mustChange = false) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const saltHex   = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const hash      = await pbkdf2(newPassword, saltBytes)
  await exec(
    'UPDATE admin_users SET hash = ?, salt = ?, must_change = ? WHERE username = ?',
    [txt(hash), txt(saltHex), int(mustChange ? 1 : 0), txt(username)]
  )
}

// Genera una clave generica que cumple la politica (8+, letras + numeros, sin espacios)
export function genGenericPassword() {
  const rnd = crypto.getRandomValues(new Uint8Array(5))
  const digits = Array.from(rnd).map(b => b % 10).join('')
  return `HPG${digits}` // ej. HPG40193
}

// ── Stats ────────────────────────────────────────────────
export async function getStats(days = 28) {
  const pf = days > 0 ? `created_at >= datetime('now', '-${days} days')` : '1=1'

  // Inscripciones confirmadas REALES desde la tabla activity_registrations (fuente de verdad,
  // coincide con la pestaña Inscripciones). Los bot_events activity_reg_confirm pueden faltar.
  const rpf = days > 0 ? `created_at >= datetime('now', '-${days} days')` : '1=1'

  const [byType, byDayType, sessions, todayByType, yesterdayByType, waSources, reservaSources, confirmaSources, intentSources,
         regConfPeriod, regConfToday, regConfYest, regConfReal] = await Promise.all([
    exec(`SELECT event_type, COUNT(*) as cnt FROM bot_events WHERE ${pf} GROUP BY event_type ORDER BY cnt DESC`),
    exec(`SELECT date(created_at) as day, event_type, COUNT(*) as cnt FROM bot_events WHERE created_at >= datetime('now', '-13 days') GROUP BY day, event_type ORDER BY day ASC`),
    exec(`SELECT COUNT(DISTINCT session_id) as cnt FROM bot_events WHERE ${pf}`),
    exec(`SELECT event_type, COUNT(*) as cnt FROM bot_events WHERE date(created_at) = date('now') GROUP BY event_type`),
    exec(`SELECT event_type, COUNT(*) as cnt FROM bot_events WHERE date(created_at) = date('now', '-1 day') GROUP BY event_type`),
    exec(`SELECT json_extract(metadata, '$.source') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'whatsapp_click' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT json_extract(metadata, '$.source') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'reserva_click' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT json_extract(metadata, '$.source') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'reserva_confirmada' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT COALESCE(json_extract(metadata, '$.activity_name'), 'General') as source, COUNT(*) as cnt FROM bot_events WHERE event_type = 'activity_reg_intent' AND ${pf} GROUP BY source ORDER BY cnt DESC`),
    exec(`SELECT COUNT(*) as cnt FROM activity_registrations WHERE ${rpf}`),
    exec(`SELECT COUNT(*) as cnt FROM activity_registrations WHERE date(created_at) = date('now')`),
    exec(`SELECT COUNT(*) as cnt FROM activity_registrations WHERE date(created_at) = date('now', '-1 day')`),
    exec(`SELECT COALESCE(NULLIF(TRIM(event_name), ''), NULLIF(TRIM(activity_name), ''), 'General') as source, COUNT(*) as cnt FROM activity_registrations WHERE ${rpf} GROUP BY source ORDER BY cnt DESC`),
  ])

  const regReal = parseRows(regConfReal)

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
    // Siempre desde la tabla real (activity_registrations) — coincide con la pestaña Inscripciones.
    // NO usar bot_events (datos viejos con casing inconsistente: "Zumba"/"zumba").
    regConfirmSources: regReal,
    // Inscripciones confirmadas reales (tabla activity_registrations)
    regConfirmed:          Number(parseRows(regConfPeriod)[0]?.cnt ?? 0),
    regConfirmedToday:     Number(parseRows(regConfToday)[0]?.cnt ?? 0),
    regConfirmedYesterday: Number(parseRows(regConfYest)[0]?.cnt ?? 0),
  }
}

export async function clearEvents() {
  await exec('DELETE FROM bot_events')
}

// Reinicia a 0 las inscripciones a eventos/actividades (zumba, yoga, etc.):
// borra los registros confirmados y los eventos de intento/confirmación de inscripción.
// NO toca reservas de hotel, WhatsApp ni mensajes del bot.
export async function clearActivityInscriptions() {
  await exec('DELETE FROM activity_registrations')
  await exec("DELETE FROM bot_events WHERE event_type IN ('activity_reg_intent', 'activity_reg_confirm')")
}

// Reset total: borra TODOS los eventos, actividades y asistentes.
// Deja la app como nueva. NO toca usuarios admin ni suscripciones push.
export async function resetAllEventsAndAttendees() {
  await exec('DELETE FROM activity_registrations')
  await exec('DELETE FROM event_registrations')
  await exec('DELETE FROM hotel_events')
  await exec('DELETE FROM activities')
  await exec("DELETE FROM bot_events WHERE event_type IN ('activity_reg_intent', 'activity_reg_confirm')")
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
    `SELECT r.id, r.activity_id, r.activity_name, r.event_id, r.event_name,
            r.full_name, r.phone, r.whatsapp, r.payment_method, r.paid, r.checked_in,
            r.checked_in_at, r.transfer_proof_url, r.created_at,
            e.date as event_date, e.price as event_price, e.description as event_description
     FROM activity_registrations r
     LEFT JOIN hotel_events e ON r.event_id = e.id
     WHERE r.id = ?`,
    [int(id)]
  )
  return parseRows(res)[0] ?? null
}

export async function updateTransferProof(id, proofUrl) {
  const now = `datetime('now')`
  await exec(
    `UPDATE activity_registrations SET transfer_proof_url = ?, paid = 1, paid_at = ${now} WHERE id = ?`,
    [txt(proofUrl), int(id)]
  )
}

export async function saveTransferProof(id, proofUrl) {
  await exec(
    `UPDATE activity_registrations SET transfer_proof_url = ? WHERE id = ?`,
    [txt(proofUrl), int(id)]
  )
}
