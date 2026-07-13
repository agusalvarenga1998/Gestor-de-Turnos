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
