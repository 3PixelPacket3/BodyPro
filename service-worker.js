// service-worker.js - BodyPro Background Engine

const CACHE_NAME = 'bodypro-cache-v2.0.0';

// We use relative paths ('./') to prevent 404 errors when hosted in subdirectories like GitHub Pages
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
  './social.html',
  './social.js',
  './settings.html',
  './settings.js',
  './style.css',
  './data-store.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// --- INSTALL EVENT ---
// Fires when the service worker is first registered. We cache the core shell here.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[BodyPro Service Worker] Caching core assets for offline availability.');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Forces the waiting service worker to become the active service worker.
});

// --- ACTIVATE EVENT ---
// Fires after install. Good time to clean up old caches if we update the CACHE_NAME version.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[BodyPro Service Worker] Clearing obsolete cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all pages immediately.
});

// --- FETCH EVENT ---
// Intercepts all network requests.
self.addEventListener('fetch', event => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests unless they are our specific CDN assets
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.includes('cdnjs.cloudflare.com')) {
      return;
  }

  // Network-First Strategy
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // If the network request succeeds, clone the response and update the cache
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // If the network request fails (offline), serve from cache
        console.log('[BodyPro Service Worker] Network failure detected. Deploying cached fallback for:', event.request.url);
        return caches.match(event.request);
      })
  );
});
