// Update this version string with every deployment to force cache refresh
const CACHE = 'travelens-v' + new Date().toISOString().split('T')[0].replace(/-/g,'');
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', e => {
  // Delete ALL old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // Take control immediately
});

self.addEventListener('fetch', e => {
  // Never cache API calls
  if (e.request.url.includes('/api/') || 
      e.request.url.includes('anthropic.com') ||
      e.request.url.includes('upstash.io')) return;
  
  // Network first for HTML — always get latest version
  if (e.request.url.endsWith('.html') || e.request.url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache first for other assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
