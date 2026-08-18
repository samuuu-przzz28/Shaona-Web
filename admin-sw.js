// Service Worker mínimo para hacer instalable el panel admin (PWA)
// Cachea el shell básico para que abra al instante y funcione con red pobre.
const CACHE = 'shaona-admin-v1';
const SHELL = [
  '/admin.html',
  '/shaona-config.js',
  '/admin-manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Estrategia: network first para HTML y llamadas a Supabase (datos frescos),
// cache first para assets estáticos.
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Nunca cachear llamadas a Supabase (siempre red)
  if (url.hostname.endsWith('supabase.co')) return;

  // HTML → network first, fallback a cache si offline
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(m => m || caches.match('/admin.html')))
    );
    return;
  }

  // Resto → cache first, red como fallback
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      // Solo cachear GET exitosos same-origin
      if (req.method === 'GET' && res.ok && url.origin === self.location.origin){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
