const CACHE_NAME = 'offline-cache-v3'; // ← bump this every time you update

const OFFLINE_URL = './offline.html';  // <-- path updated

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installed.');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
         './',
        './index.html',
        './offline.html', 
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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

