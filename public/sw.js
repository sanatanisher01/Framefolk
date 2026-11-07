const CACHE_VERSION = "mw6qzex0";
const STATIC_CACHE = `framefolk-static-${CACHE_VERSION}`;
const STATIC_PRECACHE = ["/offline", "/manifest.json", "/favicon.svg"];
self.addEventListener("install", event => {
 event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_PRECACHE)));
 self.skipWaiting();
});
self.addEventListener("activate", event => {
 event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter(k => k.startsWith("framefolk-") && k !== STATIC_CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
 })());
});
self.addEventListener("message", event => {
 if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", event => {
 const request = event.request, url = new URL(request.url);
 if (request.method !== "GET" || url.origin !== self.location.origin) return;
 if (url.pathname.startsWith("/_next/static/") || STATIC_PRECACHE.includes(url.pathname) || url.pathname.startsWith("/icons/")) {
  event.respondWith((async () => {
   const cache = await caches.open(STATIC_CACHE), hit = await cache.match(request);
   if (hit) return hit;
   const response = await fetch(request);
   if (response.ok) await cache.put(request, response.clone());
   return response;
  })());
 } else if (request.mode === "navigate") {
  // Network only: an offline shared device must never replay another user's page.
  event.respondWith(fetch(request).catch(async () => (await caches.match("/offline")) || new Response("Offline", { status: 503 })));
 }
});
self.addEventListener("push", event => {
 if (!event.data) return;
 let data; try { data = event.data.json(); } catch { data = { body: event.data.text() }; }
 event.waitUntil(self.registration.showNotification(data.title || "FRAMEFOLK", { body: data.body || "", icon: "/icons/icon-192.svg", data: { url: data.url || "/notifications" } }));
});
self.addEventListener("notificationclick", event => {
 event.notification.close();
 const url = new URL(event.notification.data?.url || "/notifications", self.location.origin);
 if (url.origin !== self.location.origin) return;
 event.waitUntil(self.clients.openWindow(url.href));
});
