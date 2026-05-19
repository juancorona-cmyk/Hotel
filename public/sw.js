// Service Worker — Hotel Punta Galería Push Notifications
const APP_URL = 'https://hotelpuntagaleria.mx/checkin'

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Hotel Punta Galería', body: event.data.text() } }

  const title = data.title || 'Hotel Punta Galería'
  const options = {
    body: data.body || 'Nuevo registro recibido',
    icon: '/logo/logNegro.svg',
    badge: '/logo/logNegro.svg',
    tag: data.tag || 'hotel-notif',
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: data.url || APP_URL, regId: data.regId || null },
    actions: [
      { action: 'open', title: 'Ver registro' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || APP_URL

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Si la app ya está abierta, la enfoca
      for (const client of list) {
        if (client.url.includes('hotelpuntagaleria.mx') && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Si no está abierta, la abre
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))
