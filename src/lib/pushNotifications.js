import { Capacitor } from '@capacitor/core'
import { API_BASE } from './turso'

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// ── Native Android (FCM) ──────────────────────────────────
async function subscribeNativeFCM() {
  const { PushNotifications } = await import('@capacitor/push-notifications')

  const permStatus = await PushNotifications.requestPermissions()
  if (permStatus.receive !== 'granted') return null

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 10000)

    PushNotifications.addListener('registration', async ({ value: token }) => {
      clearTimeout(timeout)
      try {
        await fetch(`${API_BASE}/.netlify/functions/push-subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token }),
        })
      } catch {}
      resolve(token)
    })

    PushNotifications.addListener('registrationError', () => {
      clearTimeout(timeout)
      resolve(null)
    })

    // Foreground notification — trigger in-app alert
    PushNotifications.addListener('pushNotificationReceived', (notif) => {
      const event = new CustomEvent('hotel:push', { detail: notif })
      window.dispatchEvent(event)
    })

    // Notification tap — navigate to URL
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = action.notification.data?.url
      if (url) {
        try {
          const path = new URL(url).pathname + new URL(url).search
          window.location.href = path
        } catch { window.location.href = url }
      }
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
    console.warn('[push] subscribeToPush failed:', err)
    return null
  }
}

export async function sendPushNotification(payload) {
  try {
    await fetch(`${API_BASE}/.netlify/functions/push-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.warn('[push] notify failed:', err)
  }
}
