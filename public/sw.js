const CACHE_NAME = 'labmate-v3';

// Install: precache essential shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Only precache the HTML shell and recipes — JS/CSS are hashed and cached on first fetch
      return cache.addAll([
        './',
        './index.html',
        './recipes.json',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Hashed assets (JS/CSS with hash in filename): cache-first (immutable)
// - index.html and recipes.json: network-first (always get latest)
// - Google Fonts: cache-first
// - Everything else: network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Hashed assets: cache-first (they're immutable by hash)
  if (url.pathname.match(/\/assets\/.*-[a-zA-Z0-9]{8}\.(js|css|png|svg|ico|json)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Google Fonts: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // App shell (index.html, recipes.json): network-first
  if (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/recipes.json') ||
      url.pathname.endsWith('/') || url.pathname === url.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
});
