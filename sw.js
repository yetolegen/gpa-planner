const KEY = "gpa-v5";
const SHELL = ["./", "index.html", "style.css", "core.js", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "vendor/inter/inter-latin.woff2", "vendor/inter/inter-latin-ext.woff2", "vendor/inter/inter-cyrillic.woff2", "vendor/inter/inter-cyrillic-ext.woff2"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(KEY).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== KEY).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(KEY).then(async (c) => {
    const hit = await c.match(r);
    const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
