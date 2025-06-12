const CACHE_NAME = 'offline-cache-v3'; // ← bump this every time you update

const OFFLINE_URL = 'student_photos/offline.html';  // <-- path updated

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installed.');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        'student_photos/',             // root page
        'student_photos/index.html',
        'student_photos/offline.html',
        'student_photos/style.css',    // add if you have styles
        // other files like JS, images etc
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

