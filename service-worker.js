const CACHE_NAME = 'offline-cache-v1';
const OFFLINE_URL = 'offline.html';

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installed.');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/offline.html',
        '/style.css',      // include important files here
        // Add other JS, fonts, icons if needed
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        return response || caches.match(OFFLINE_URL);
      });
    })
  );
});
