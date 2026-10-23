/* Calculator10 service worker. Bump VERSION whenever site files change. */
const VERSION = 'v25';
const CORE = 'smartcalc-core-' + VERSION;
const RUNTIME = 'smartcalc-rt-' + VERSION;
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/privacy.html', '/about.html', '/contact.html', '/404.html', '/owner.jpg', '/favicon.ico', '/favicon-32.png', '/zakat-calculator.html', '/zakat.js', '/bmi-calculator.html', '/bmi.js', '/emi-calculator.html', '/emi.js', '/gst-calculator.html', '/gst.js', '/word-counter.html', '/word-counter.js'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CORE)
      .then(c => Promise.all(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CORE && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(res) { return res && (res.ok || res.type === 'opaque'); }

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(req).then(hit => {
      const net = fetch(req).then(res => { if (cacheable(res)) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // Pages: network first (so updates appear), fall back to cache when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CORE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(hit => hit || caches.match('/index.html') || caches.match('/'))
      )
    );
    return;
  }
  // Same-origin files: serve cached copy instantly, refresh in background.
  if (url.origin === self.location.origin) { e.respondWith(staleWhileRevalidate(req, CORE)); return; }
  // Google Fonts only: cache after first load so fonts also work offline.
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(staleWhileRevalidate(req, RUNTIME)); return; }
  // Everything else (e.g. the optional translation request) is never cached.
});
