const CACHE = 'prode2026-v4';

// Solo cachear assets estáticos — NUNCA páginas HTML
const STATIC = [
  '/logo.png',
  '/favicon.ico',
  '/manifest.json',
  '/matches-data.js',
  '/firebase-config.js',
  '/install-banner.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Nunca cachear HTML — siempre ir a la red para tener la versión más reciente
  if (
    e.request.headers.get('Accept')?.includes('text/html') ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/'
  ) return;

  // Ignorar APIs externas
  if (
    url.hostname !== self.location.hostname ||
    url.href.includes('firestore') ||
    url.href.includes('googleapis') ||
    url.href.includes('pagead') ||
    url.href.includes('firebase')
  ) return;

  // Cache-first para assets estáticos
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
