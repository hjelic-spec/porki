// Offline cache aplikacijske ljuske. Povećaj VERSION pri svakoj objavi.
const VERSION = 'porki-v30';
const MODULES = [
  './js/app.js',
  './js/backup.js',
  './js/core/analysis.js',
  './js/core/fast.js',
  './js/core/format.js',
  './js/core/ketones.js',
  './js/core/nutrition.js',
  './js/core/weight.js',
  './js/dialogs/entries.js',
  './js/dialogs/food.js',
  './js/dialogs/scanner.js',
  './js/dialogs/search.js',
  './js/dialogs/settings.js',
  './js/native/health.js',
  './js/native/widget.js',
  './js/reports.js',
  './js/store.js',
  './js/ui/charts.js',
  './js/ui/dialog.js',
  './js/ui/dom.js',
  './js/ui/render.js',
  './js/views/analysis.js',
  './js/views/fast.js',
  './js/views/food.js',
  './js/views/ketones.js',
  './js/views/recipes.js',
  './js/views/today.js',
  './js/views/weight.js'
];
const ASSETS = [...MODULES, './', './index.html', './foods.js', './recipes.js', './vendor/zxing.min.js', './styles.css', './capacitor.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable.png', './privacy.html'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Stale-while-revalidate: odmah iz cachea, u pozadini osvježi
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  ev.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const net = fetch(req).then(res => { if (res.ok) cache.put(req.mode === 'navigate' ? './' : req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
