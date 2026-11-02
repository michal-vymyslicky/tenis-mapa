// Jednoduchý service worker: aplikace funguje i při slabém signálu (data: nejdřív síť, pak mezipaměť).
const C = "tenismapa-v9";
const SHELL = ["./", "index.html", "app.css", "app.js", "i18n.js", "icon.svg", "vendor/leaflet.js", "vendor/leaflet.css",
  "vendor/leaflet.markercluster.js", "vendor/MarkerCluster.css"];
self.addEventListener("install", e => e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request)));
});
