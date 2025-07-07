const CACHE_NAME = 'cyrus-video-ai-v2'; /* IMPORTANT: NEW CACHE NAME TO FORCE UPDATE */
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/cyrus_narrative_video.mp4', /* Add this if you use cyrus_narrative_video.mp4 */
    '/icon-192x192.png',
    '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing version v2...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Opened cache v2, adding URLs');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('[Service Worker] Failed to cache during install (v2):', error);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response; // Found in cache, return it
                }
                // Not found in cache, fetch from network
                return fetch(event.request).catch(error => {
                    console.warn('[Service Worker] Fetch failed for:', event.request.url, error);
                    // Optionally return an offline fallback page here if network is down
                });
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating version v2...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Activated v2. Claiming clients.');
            return self.clients.claim(); // Ensures the new service worker takes control immediately
        })
    );
});