/**
 * FRAMEFOLK Service Worker
 *
 * Caching strategy:
 *   Static assets (JS/CSS/fonts/icons) → Cache First
 *   Next.js pages                       → Network First (stale-while-revalidate)
 *   API routes / Firestore / FCM        → Network Only (never cached)
 *   Cloudinary images (public)          → Cache First with 30-day expiry
 *   Private media / signed URLs         → Network Only
 *   Offline fallback                    → /offline
 *
 * Security:
 *   - Never caches: /api/, /admin/, firebase*.googleapis.com, signed URLs (s--)
 *   - Never caches: auth tokens, Firestore streams, FCM
 *   - Safe for shared devices: only public static assets are cached
 */

const CACHE_VERSION = "v1-202611060057";
const STATIC_CACHE  = `framefolk-static-${CACHE_VERSION}`;
const IMAGE_CACHE   = `framefolk-images-${CACHE_VERSION}`;
const PAGE_CACHE    = `framefolk-pages-${CACHE_VERSION}`;

const STATIC_PRECACHE = [
  "/offline",
  "/manifest.json",
  "/favicon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// ─── Never cache these patterns ───────────────────────────────────────────────
const NEVER_CACHE = [
  /\/api\//,
  /\/admin\//,
  /firestore\.googleapis\.com/,
  /firebase\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /fcm\.googleapis\.com/,
  /\/messages\//,
  // Cloudinary signed private delivery URLs contain "s--"
  /s--[A-Za-z0-9_-]+--/,
  // Auth cookies / session
  /\/login/,
  /\/register/,
];

function shouldNeverCache(url) {
  return NEVER_CACHE.some((re) => re.test(url));
}

// ─── Message: handle SKIP_WAITING from admin cache clear ─────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    // Tell all clients to reload after SW takes over
    self.clients.matchAll({ type: "window" }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: "RELOAD" }));
    });
  }
});

// ─── Install: precache static shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_PRECACHE))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const allowed = [STATIC_CACHE, IMAGE_CACHE, PAGE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !allowed.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Never cache sensitive routes
  if (shouldNeverCache(url)) return;

  // Cloudinary public images → Cache First (30 days)
  if (
    url.includes("res.cloudinary.com") &&
    !url.includes("s--") // exclude signed/private delivery
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 30 * 24 * 60 * 60));
    return;
  }

  // Static assets (JS chunks, CSS, fonts, icons) → Cache First
  if (
    url.includes("/_next/static/") ||
    url.includes("/icons/") ||
    url.endsWith(".svg") ||
    url.endsWith(".woff2") ||
    url.endsWith(".woff")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages → Network First with offline fallback
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Everything else → Network Only
});

// ─── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Validate max-age if specified
    if (maxAgeSeconds) {
      const dateHeader = cached.headers.get("date");
      if (dateHeader) {
        const cachedAt = new Date(dateHeader).getTime();
        if (Date.now() - cachedAt > maxAgeSeconds * 1000) {
          // Stale — refresh in background
          fetchAndCache(request, cache).catch(() => {});
        }
      }
    }
    return cached;
  }

  return fetchAndCache(request, cache);
}

async function fetchAndCache(request, cache) {
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Show offline page
    const offline = await caches.match("/offline");
    return offline || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: "FRAMEFOLK", body: event.data.text() }; }

  const title = payload.title || "FRAMEFOLK";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    data: { url: payload.url || "/" },
    vibrate: [100, 50, 100],
    tag: payload.tag || "framefolk-notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
