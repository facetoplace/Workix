/* Workix hub service worker — offline shell cache */
const CACHE = 'workix-hub-v1';
const PRECACHE = [
  '/',
  '/hub/styles.css',
  '/hub/app.js',
  '/hub/api.js',
  '/hub/auth.js',
  '/hub/i18n.js',
  '/hub/mock-db.js',
  '/img/logo-pwa.png',
  '/favicon-32x32.png',
  '/pwa.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok && (url.pathname.startsWith('/hub/') || url.pathname === '/' || url.pathname.endsWith('.png') || url.pathname.endsWith('.json'))) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
