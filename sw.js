// ─── Exp-Track Service Worker ────────────────────────────
// Cache version bump forces clean re-cache on every deploy
const CACHE_NAME = 'exptrack-v3.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET' || url.startsWith('chrome-extension')) return;

  const isCDN = CDN_ASSETS.some(a => url.startsWith(a.split('/chart')[0]));
  const isNavigate = e.request.mode === 'navigate';
  const isDoc = isNavigate || e.request.destination === 'document';

  if (isDoc) {
    // NETWORK-FIRST for the app shell so code updates always take effect.
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
  } else if (isCDN) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(e.request)
            .then(res => {
              if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
              }
              return res;
            })
            .catch(() => isNavigate ? caches.match('./index.html') : Response.error());
        })
    );
  }
});
