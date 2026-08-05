/* SafeOps360 Field Capture — service worker (scope: /capture).
 *
 * Hand-rolled on purpose (DECISIONS.md D11): Workbox would add a build-pipeline
 * dependency for the same three strategies used here —
 *   • navigations under /capture ......... network-first, cache fallback (offline relaunch)
 *   • /_next/static + images + fonts ..... cache-first (content-hashed, immutable)
 *   • capture boot APIs (taxonomy, boot).. network-first, cache fallback (offline boot)
 *   • everything else .................... network only (mutations go through the
 *                                          IndexedDB outbox in app code, never the SW)
 *
 * Bump CACHE_VERSION on breaking cache-shape changes; activate cleans old caches.
 */

const CACHE_VERSION = "capture-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const API_CACHE = `${CACHE_VERSION}-api`;

const PRECACHE_URLS = ["/capture", "/capture/mine", "/manifest.json", "/capture-icon-192.png", "/capture-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined) // partial precache is fine — runtime caching fills gaps
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/capture-icon-") ||
    url.pathname === "/manifest.json" ||
    /\.(?:woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

function isBootApi(url) {
  return (
    url.pathname === "/api/capture/taxonomy" ||
    url.pathname === "/api/capture/bootstrap" ||
    url.pathname === "/api/capture/submissions/mine"
  );
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // mutations: app-level outbox, never the SW

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }
  if (isBootApi(url)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }
  // other API GETs: network only
});
