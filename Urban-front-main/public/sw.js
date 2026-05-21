const CACHE_VERSION = "urban-ai-pwa-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PUSH_CONFIG_CACHE = `${CACHE_VERSION}-push-config`;
const PUSH_CONFIG_REQUEST = "/__urban_ai_push_config";
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

self.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type === "URBAN_PUSH_CONFIG") {
    event.waitUntil(storePushConfig(message.config));
  }
  if (message.type === "URBAN_PUSH_CONFIG_CLEAR") {
    event.waitUntil(clearPushConfig());
  }
});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePushEvent(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = event.notification?.data?.url || "/notificacao";
  event.waitUntil(openOrFocusClient(targetUrl));
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

async function handlePushEvent(event) {
  const payloads = [];

  if (event.data) {
    const parsed = parsePushPayload(event.data);
    if (parsed) payloads.push(parsed);
  }

  if (payloads.length === 0) {
    const pending = await fetchPendingPushDeliveries();
    payloads.push(...pending);
  }

  if (payloads.length === 0) {
    payloads.push({
      title: "Urban AI",
      body: "Voce tem uma nova notificacao.",
      url: "/notificacao",
      tag: "urban-ai-generic",
    });
  }

  await Promise.all(payloads.map((payload) => showUrbanNotification(payload)));
}

function parsePushPayload(data) {
  try {
    return data.json();
  } catch {
    try {
      return { title: "Urban AI", body: data.text(), url: "/notificacao" };
    } catch {
      return null;
    }
  }
}

async function fetchPendingPushDeliveries() {
  const config = await readPushConfig();
  if (!config?.deviceId || !config?.secret) return [];

  const apiBaseUrl = (config.apiBaseUrl || self.location.origin).replace(/\/$/, "");
  const url = `${apiBaseUrl}/push/deliveries/next?deviceId=${encodeURIComponent(config.deviceId)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Urban-Push-Secret": config.secret,
      },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.notifications) ? data.notifications : [];
  } catch {
    return [];
  }
}

async function showUrbanNotification(payload) {
  const title = payload.title || "Urban AI";
  const url = normalizeNotificationUrl(payload.url || payload?.data?.url || "/notificacao");
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/pwa-icon-192.png",
    badge: payload.badge || "/maskable-icon-512.png",
    tag: payload.tag || payload.deliveryId || "urban-ai-notification",
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      ...(payload.data || {}),
      deliveryId: payload.deliveryId,
      url,
    },
    actions: Array.isArray(payload.actions)
      ? payload.actions.slice(0, 2)
      : [{ action: "open", title: "Ver" }],
  };

  return self.registration.showNotification(title, options);
}

async function openOrFocusClient(targetUrl) {
  const normalizedPath = normalizeNotificationUrl(targetUrl);
  const absoluteUrl = new URL(normalizedPath, self.location.origin).href;
  const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of windows) {
    const clientUrl = new URL(client.url);
    if (clientUrl.origin === self.location.origin) {
      if ("navigate" in client) await client.navigate(absoluteUrl);
      return client.focus();
    }
  }

  return clients.openWindow(absoluteUrl);
}

function normalizeNotificationUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return "/notificacao";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/notificacao";
  }
}

async function storePushConfig(config) {
  if (!config?.deviceId || !config?.secret) return;
  const cache = await caches.open(PUSH_CONFIG_CACHE);
  await cache.put(
    PUSH_CONFIG_REQUEST,
    new Response(JSON.stringify(config), {
      headers: { "Content-Type": "application/json" },
    })
  );
}

async function readPushConfig() {
  const cache = await caches.open(PUSH_CONFIG_CACHE);
  const response = await cache.match(PUSH_CONFIG_REQUEST);
  if (!response) return null;
  try {
    return response.json();
  } catch {
    return null;
  }
}

async function clearPushConfig() {
  const cache = await caches.open(PUSH_CONFIG_CACHE);
  await cache.delete(PUSH_CONFIG_REQUEST);
}
