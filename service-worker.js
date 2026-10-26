// service-worker.js - BodyPro Background Offline & Notification Engine v3.0.0

const CACHE_NAME = 'bodypro-cache-v3.0.0';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './login.html',
  './login.js',
  './dashboard.html',
  './dashboard.js',
  './nutrition.html',
  './nutrition.js',
  './recipes.html',
  './recipes.js',
  './fitness.html',
  './fitness.js',
  './analytics.html',
  './analytics.js',
  './social.html',
  './social.js',
  './settings.html',
  './settings.js',
  './style.css',
  './data-store.js',
  './manifest.json',
  './favicon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/html5-qrcode'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[BodyPro Service Worker] Caching complete application shell for offline availability.');
      return Promise.allSettled(ASSETS_TO_CACHE.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const isAllowedCDN = url.includes('cdnjs.cloudflare.com') || url.includes('cdn.jsdelivr.net') || url.includes('unpkg.com') || url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com');

  if (!url.startsWith(self.location.origin) && !isAllowedCDN) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./dashboard.html');
          }
        });
      })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('fitness.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./fitness.html');
      }
    })
  );
});
