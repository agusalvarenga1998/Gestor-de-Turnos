// TurnoHub PWA Service Worker
const CACHE_NAME = 'turnohub-pwa-v1';

// No cache storage to keep client-side updates real-time and prevent chunk-loading conflicts.
// The browser will check this file for installation requirements.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch directly to the network.
  // This satisfies PWA install check while keeping files always fresh.
  event.respondWith(fetch(event.request));
});

// Manejo de eventos de Notificaciones Push
self.addEventListener('push', (event) => {
  let data = { title: 'TurnoHub', body: 'Nueva notificación.' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'TurnoHub', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/logo_turnohub.png',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Al hacer clic en la notificación, abre o enfoca la app en la ruta indicada
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Si hay una pestaña abierta de la app, la enfocamos
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.indexOf(urlToOpen) !== -1 && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay pestañas abiertas, abrimos una nueva
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
