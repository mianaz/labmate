const CACHE_NAME = 'labmate-v9';

// Filled in at build time by vite.config.js (closeBundle): every hashed JS/CSS
// chunk of this build, so a freshly installed PWA works offline on every tab,
// not only the ones the user happened to open before going offline.
const PRECACHE_ASSETS = /*__PRECACHE_ASSETS__*/[];

// Install: precache essential shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Only precache the HTML shell and recipes — JS/CSS are hashed and cached on first fetch
      return cache.addAll([
        './',
        './index.html',
        './recipes.json',
        ...PRECACHE_ASSETS,
      ]);
    })
  );
  // Intentionally no self.skipWaiting() here — a new SW should sit in `waiting` until
  // the user accepts the update toast (see message handler below), not silently take
  // over an in-progress session.
});

// Let the page trigger activation on demand (see main.jsx / Toast.jsx update flow)
// instead of the new SW silently taking over mid-session.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => pruneStaleAssets())
  );
  self.clients.claim();
});

// Hashed assets are cached first-hit-forever, so without pruning every deploy
// leaves the previous build's chunks in the cache. Drop any /assets/ entry that
// is not part of this build's precache list.
async function pruneStaleAssets() {
  if (!PRECACHE_ASSETS.length) return;
  const keep = new Set(PRECACHE_ASSETS.map((p) => new URL(p, self.registration.scope).pathname));
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  await Promise.all(requests.map((req) => {
    const path = new URL(req.url).pathname;
    if (path.includes('/assets/') && !keep.has(path)) return cache.delete(req);
    return undefined;
  }));
}

// Fetch strategy:
// - Hashed assets (JS/CSS with hash in filename): cache-first (immutable)
// - index.html and recipes.json: network-first (always get latest)
// - Everything else: network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) schemes (e.g. chrome-extension://) — Cache API rejects them
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Same-origin only. The SW must never fetch or cache a cross-origin payload:
  // a cross-origin recipes.json (the old raw.githubusercontent.com sync) would
  // otherwise be network-first cached here, turning an unverified remote into a
  // persistent poisoned cache. Recipe integrity is enforced app-side at ingestion.
  if (url.origin !== self.location.origin) return;

  // Hashed assets: cache-first (they're immutable by hash). Vite's 8-char hashes
  // use a base64url-style alphabet that includes '-' and '_' (e.g.
  // react-vendor-DZ7-1DMe.js), so the class must allow them — with [a-zA-Z0-9]
  // alone those chunks bypassed the cache and the app could not boot offline.
  if (url.pathname.match(/\/assets\/.*-[A-Za-z0-9_-]{8}\.(js|css|png|svg|ico|json|woff2?)$/)) {
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

  // App shell: network-first, falling back to the cached shell.
  // `mode === 'navigate'` (not just an index.html/recipes.json/'/' suffix match)
  // covers every locale-prefixed deep link (/labmate/en/recipes, /labmate/zh/calc,
  // etc.) — those URLs don't end in '/' or 'index.html', but a direct load / hard
  // refresh / PWA relaunch on one is still a full-page navigation request that
  // needs to fall back to the cached app shell when offline.
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('/index.html') || url.pathname.endsWith('/recipes.json') ||
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
        // ignoreSearch: a request that carries a query string (e.g. a tracking or
        // legacy `?t=` parameter) must still hit the precached canonical entry.
        .catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }
});
