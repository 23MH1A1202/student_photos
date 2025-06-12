const CACHE_NAME = 'offline-cache-v2';
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
