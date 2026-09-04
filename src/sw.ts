/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Activate a newly installed worker immediately instead of leaving it
// "waiting" until every open tab/PWA instance is closed — a household of
// two, each often leaving the app open for days, would otherwise sit on a
// stale build indefinitely. Paired with the registerSW(...) call in
// main.tsx, which reloads the page once this new worker takes control.
self.skipWaiting()
clientsClaim()

interface PushPayload {
  title: string
  body: string
  url?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = { title: 'A²', body: 'You have a new update.' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    // Non-JSON payload — fall back to the default above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons.svg',
      badge: '/icons.svg',
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
