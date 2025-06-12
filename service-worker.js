const CACHE_NAME = 'offline-cache-v1';
const OFFLINE_URL = 'offline.html';
self.addEventListener('install', (event) => {
  console.log('Service Worker installed.');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/offline.html'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || caches.match(OFFLINE_URL);
      });
    })
  );
});
