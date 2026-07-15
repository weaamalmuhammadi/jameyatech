// Minimal cache-first service worker for the static app shell only.
// Deliberately does NOT touch the AI agent API (localhost:5001 / /api/*) --
// those calls must always hit the network live, never be served from cache.
var CACHE_NAME = 'jameyatech-shell-v1';
var SHELL = ['./', './index.html', './app.js', './style.css', './Logo-Jamiyahtech.png', './manifest.json'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  var isAgentApi = url.port === '5001' || url.pathname.indexOf('/api/') === 0;
  if (isAgentApi || event.request.method !== 'GET') return; // never cache/intercept agent calls

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
