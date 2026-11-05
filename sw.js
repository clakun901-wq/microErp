const V = 'micro-erp-0.3.0';
const SHELL = ['./', 'index.html', 'manifest.json', 'css/app.css', 'icons/icon.svg', 'js/main.js', 'js/store.js', 'js/config.js', 'js/ui/kit.js', 'js/ui/views.js', 'js/worker/inventory.js', 'js/worker/orders.js', 'js/worker/finance.js',
  'js/core/money.js', 'js/components/virtual-list.js', 'js/components/product-card.js',
  'js/worker/worker.js', 'js/worker/db.js', 'js/worker/pricing.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener('fetch', e => { // cache-first, termasuk CDN (signals + sqlite wasm) setelah pemuatan pertama
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(e.request, cp)); }
    return res;
  })));
});
