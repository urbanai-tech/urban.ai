const CACHE_VERSION = "urban-ai-pwa-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/offline.html",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/maskable-icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(
          STATIC_ASSETS.map((asset) =>
            cache.add(new Request(asset, { cache: "reload" }))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)))
        ),
      "navigationPreload" in self.registration
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
    ]).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    STATIC_ASSETS.includes(url.pathname) ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirstNavigation(event) {
  const request = event.request;

  try {
    const preloadedResponse = await event.preloadResponse;
    if (preloadedResponse) return preloadedResponse;

    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    return (await cache.match("/offline.html")) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.status === 200) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}
