import { Capacitor } from '@capacitor/core'
import { API_BASE } from './turso'

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function saveFCMToken(token) {
  const res = await fetch(`${API_BASE}/.netlify/functions/push-subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fcmToken: token }),
  })
  if (!res.ok) throw new Error(`push-subscribe returned ${res.status}`)
  return res.json()
}

// ── Native Android (FCM) ──────────────────────────────────
async function subscribeNativeFCM() {
  const { PushNotifications } = await import('@capacitor/push-notifications')

  // Limpiar listeners previos para evitar duplicados en re-mounts
  await PushNotifications.removeAllListeners()

  const permStatus = await PushNotifications.requestPermissions()
  if (permStatus.receive !== 'granted') {
    console.warn('[push] FCM permission denied')
    return null
  }

  // Crear canal de notificación (Android 8+ requiere canal registrado en el dispositivo)
  await PushNotifications.createChannel({
    id: 'hotel_push',
    name: 'Hotel Punta Galería',
    description: 'Nuevos registros y pagos',
    importance: 5,        // IMPORTANCE_HIGH — aparece como banner emergente
    visibility: 1,        // VISIBILITY_PUBLIC — visible en pantalla de bloqueo
    vibration: true,
    sound: 'default',
    lights: true,
  }).catch(() => {})      // Ignorar si el canal ya existe

  // Escuchar push en primer plano → emitir evento para que StaffApp muestre alerta
  PushNotifications.addListener('pushNotificationReceived', (notif) => {
    window.dispatchEvent(new CustomEvent('hotel:push', { detail: notif }))
  })

  // Tap en la notificación → navegar al ticket
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url
    if (url) {
      try {
        const { pathname, search } = new URL(url)
        window.location.href = pathname + search
      } catch { window.location.href = url }
    }
  })

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[push] FCM registration timeout')
      resolve(null)
    }, 12000)

    PushNotifications.addListener('registration', async ({ value: token }) => {
      clearTimeout(timeout)
      console.log('[push] FCM token:', token.slice(0, 20) + '…')
      try {
        await saveFCMToken(token)
        console.log('[push] FCM token guardado en DB ✓')
      } catch (err) {
        console.error('[push] Error guardando token:', err.message)
      }
      resolve(token)
    })

    PushNotifications.addListener('registrationError', (err) => {
      clearTimeout(timeout)
      console.error('[push] FCM registrationError:', err)
      resolve(null)
    })

    PushNotifications.register()
  })
}

// ── Browser (Web Push) ────────────────────────────────────
async function subscribeWebPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_KEY) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return null
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
    })
    await fetch(`${API_BASE}/.netlify/functions/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
    return sub
  } catch (err) {
    console.warn('[push] webpush subscribe failed:', err)
    return null
  }
}

// ── Public API ────────────────────────────────────────────
export async function subscribeToPush() {
  try {
    if (Capacitor.isNativePlatform()) {
      return await subscribeNativeFCM()
    }
    return await subscribeWebPush()
  } catch (err) {
    console.warn('[push] subscribeToPush error:', err)
    return null
  }
}

export async function sendPushNotification(payload) {
  try {
    const res = await fetch(`${API_BASE}/.netlify/functions/push-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    console.log('[push] notify result:', data)
  } catch (err) {
    console.warn('[push] notify failed:', err)
  }
}
