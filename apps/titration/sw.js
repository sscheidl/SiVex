/*
 * Service Worker für die Offline-Nutzung.
 * Strategie „Netzwerk zuerst“: Online werden immer die aktuellen Dateien
 * geladen (und im Cache aktualisiert), offline wird der Cache verwendet.
 *
 * Rücksicht auf andere Anwendungen derselben Domain (z. B. Schulserver):
 * - Beim Aktualisieren werden nur eigene, ältere Caches gelöscht
 *   (Präfix CACHE_PREFIX), niemals fremde Caches.
 * - Zwischengespeichert werden nur Anfragen innerhalb des eigenen
 *   Verzeichnisses (Scope dieses Service Workers).
 */
const CACHE_PREFIX = 'titrierlabor-';
const CACHE = CACHE_PREFIX + 'v7'; // 3.2.1
const FILES = [
  './',
  'index.html',
  'css/styles.css',
  'assets/icon.svg',
  'js/model/chemistry.js',
  'js/model/indicators.js',
  'js/model/config.js',
  'js/model/evaluation.js',
  'js/view/theme.js',
  'js/experiment/experiment.js',
  'js/view/geometry.js',
  'js/view/lab-renderer.js',
  'js/view/chart.js',
  'js/ui/app.js',
];

function inScope(url) {
  return url.startsWith(self.registration.scope);
}

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET' || !inScope(req.url)) return;
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.open(CACHE).then(function (c) { return c.match(req, { ignoreSearch: true }); });
    })
  );
});
