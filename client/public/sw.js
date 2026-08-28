/*
 * DECK service worker — makes the app installable (PWA) and keeps the shell
 * usable offline.
 *
 * Strategy:
 *  - Navigations (pages): network-first, fall back to cache, then /offline.
 *  - Immutable build assets (/_next/static/*, /icons/*): cache-first.
 *  - Other same-origin static assets (images, fonts, manifest): stale-while-revalidate.
 *  - /api/* is never cached or intercepted — data always comes from the network.
 */

const VERSION = "v1";
const STATIC_CACHE = `deck-static-${VERSION}`;
const PAGES_CACHE = `deck-pages-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      // allSettled: one failed asset must never block installation.
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* Pages: network-first → cache → offline shell. */
async function handleNavigation(event) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(event.request);
    // Cache only clean, same-origin documents (never redirects / errors).
    if (response && response.ok && response.type === "basic") {
      event.waitUntil(cache.put(event.request, response.clone()));
    }
    return response;
  } catch (err) {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw err;
  }
}

/* Immutable assets: cache-first. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const cache = await caches.open(STATIC_CACHE);
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone());
  }
  return response;
}

/* Everything else: serve from cache, refresh in the background. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts, API host, etc.
  if (url.pathname.startsWith("/api/")) return; // data is never cached here

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname === "/manifest.webmanifest" || /\.(png|jpe?g|svg|webp|avif|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
