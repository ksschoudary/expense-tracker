// ─── Spendix v2 Service Worker ───────────────────────────
// Cache version bump forces clean re-cache on every deploy
const CACHE_NAME = 'spendix-v2.1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];
// Chart.js is cached on first network hit (stale-while-revalidate pattern)
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

// INSTALL: pre-cache only local assets (CDN may fail offline install)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE: delete ALL old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH strategy:
// - Local assets: cache-first, fall back to network
// - CDN assets: network-first, fall back to cache
// - Navigation: always serve index.html from cache if offline
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Skip non-GET and chrome-extension requests
  if (e.request.method !== 'GET' || url.startsWith('chrome-extension')) return;

  const isCDN = CDN_ASSETS.some(a => url.startsWith(a.split('/chart')[0]));
  const isNavigate = e.request.mode === 'navigate';

  if (isCDN) {
    // Network-first for CDN: always try fresh, cache as fallback
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
    // Cache-first for local + navigation
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
