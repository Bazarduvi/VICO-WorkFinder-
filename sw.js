const CACHE_NAME = 'vico-workfinder-v3';
const ASSETS = ['./', './index.html', './manifest.json', './icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).then(r => {
    const rc = r.clone();
    caches.open(CACHE_NAME).then(c => { if (e.request.url.startsWith('http')) c.put(e.request, rc); });
    return r;
  }).catch(() => caches.match(e.request)));
});
