// Tennis Pro — Service Worker
// Caches the entire game for offline play

const CACHE_NAME = 'tennis-pro-v1';

// Everything needed to run offline
const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  // Google Fonts — cache them so they work offline
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap',
];

// ── INSTALL: cache all core assets ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache what we can — fonts may fail on first install if offline
      return Promise.allSettled(
        CORE_ASSETS.map(url =>
          cache.add(url).catch(() => {
            console.warn('[SW] Could not cache:', url);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fallback to network ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // For navigation requests (loading the game page)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          // Cache the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone));
          return response;
        });
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For Google Fonts and other assets — cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Only cache successful responses for same-origin or fonts
        if (
          response.ok &&
          (url.hostname === self.location.hostname ||
           url.hostname === 'fonts.googleapis.com' ||
           url.hostname === 'fonts.gstatic.com')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Return cached version if network fails
        return caches.match(request);
      });
    })
  );
});

// ── MESSAGE: force update ──
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
