// Network-first service worker for the static app shell.
// Deliberately does NOT touch the AI agent API (localhost:5001 / /api/*) --
// those calls must always hit the network live, never be served from cache.
//
// This used to be cache-first: once a file was cached, it was served from
// that cache forever, and since editing app.js/index.html/style.css never
// changes THIS file, the browser never noticed anything needed refreshing --
// users could be frozen on an old version indefinitely with no way to tell.
// Network-first fixes that: always try the live file first (so every fix
// ships immediately to anyone online), and only fall back to the cached
// copy if the network/server is actually unreachable.
var CACHE_NAME = 'jameyatech-shell-v2';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  var isAgentApi = url.port === '5001' || url.pathname.indexOf('/api/') === 0;
  if (isAgentApi || event.request.method !== 'GET') return; // never cache/intercept agent calls

  event.respondWith(
    fetch(event.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});
