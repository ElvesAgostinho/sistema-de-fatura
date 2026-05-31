// Service worker for FaturaAO (PWA)
// v2 — network-first for HTML to avoid serving stale app shells
const CACHE = 'faturaao-v2';
const PRECACHE = [
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache API calls — always go to the network
  if (url.pathname.startsWith('/api/')) return;
  // Don't intercept cross-origin requests
  if (url.origin !== self.location.origin) return;

  const isHtml = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html');

  if (isHtml) {
    // Network-first for navigations (so deploys propagate immediately)
    e.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Cache-first for static assets (js, css, images, fonts)
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
      }
      return res;
    }).catch(() => cached))
  );
});
