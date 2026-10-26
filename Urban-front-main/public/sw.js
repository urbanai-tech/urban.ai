const CACHE_PREFIX = "urban-ai-pwa-";
const CACHE_VERSION = `${CACHE_PREFIX}v5`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
// Nome fixo, fora do versionamento: o secret do push só existe aqui (a página não
// guarda cópia), então trocar CACHE_VERSION não pode apagar este cache.
const PUSH_CONFIG_CACHE = `${CACHE_PREFIX}v4-push-config`;
const ACTIVE_CACHES = new Set([STATIC_CACHE, RUNTIME_CACHE, PUSH_CONFIG_CACHE]);
const PUSH_CONFIG_REQUEST = "/__urban_ai_push_config";
const RUNTIME_CACHE_MAX_ENTRIES = 120;
// App shell: o mínimo para abrir offline com a identidade do app. Nunca inclui HTML de
// rotas autenticadas nem respostas de API.
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/offline.html",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/maskable-icon-512.png",
  "/apple-touch-icon.png",
  "/pwa-badge-96.png",
  "/favicon.ico"
];
const STATIC_FILE_PATTERN = /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico|woff2?)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await cache.add(new Request("/offline.html", { cache: "reload" }));
      await Promise.allSettled(
        STATIC_ASSETS.filter((asset) => asset !== "/offline.html").map((asset) =>
          cache.add(new Request(asset, { cache: "reload" }))
        )
      );
      // Primeira instalação não tem versão antiga para proteger: ativa já. Em atualização
      // a nova versão fica "waiting" até o usuário aceitar o aviso (mensagem URBAN_SKIP_WAITING).
      if (!self.registration.active) await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith(CACHE_PREFIX) && !ACTIVE_CACHES.has(key))
              .map((key) => caches.delete(key))
          )
        ),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
    ]).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const strategy = routeRequest(request, new URL(request.url));
  if (strategy === "navigate") {
    event.respondWith(networkFirstNavigation(event));
  } else if (strategy === "immutable") {
    event.respondWith(cacheFirst(request));
  } else if (strategy === "swr") {
    event.respondWith(staleWhileRevalidate(event));
  }
});

self.addEventListener("message", (event) => {
  // Só aceita mensagens de páginas da própria origem (o payload carrega o secret do push).
  if (event.origin !== self.location.origin) return;
  const message = event.data || {};
  if (message.type === "URBAN_PUSH_CONFIG") {
    event.waitUntil(storePushConfig(message.config));
  }
  if (message.type === "URBAN_PUSH_CONFIG_CLEAR") {
    event.waitUntil(clearPushConfig());
  }
  if (message.type === "URBAN_SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
  if (message.type === "URBAN_BADGE_CLEAR") {
    event.waitUntil(setAppBadge(0));
  }
});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePushEvent(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = resolveNotificationClickTarget(event.action, event.notification?.data);
  if (!target) return;
  event.waitUntil(openOrFocusClient(target));
});

/**
 * Decide como tratar uma requisição. Função pura (testada em scripts/pwa-sw-routing.test.mjs).
 * - "navigate": HTML de navegação, rede primeiro com fallback offline (nunca é cacheado).
 * - "immutable": /_next/static/ (nome com hash), cache primeiro.
 * - "swr": imagens/fontes/ícones do shell, stale-while-revalidate.
 * - "skip": o SW não interfere (API, outra origem, métodos não-GET, requisições autenticadas).
 */
function routeRequest(request, url) {
  if (request.method !== "GET") return "skip";
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return "skip";
  if (url.origin !== self.location.origin) return "skip";
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) return "skip";
  if (request.headers && typeof request.headers.has === "function") {
    if (request.headers.has("authorization") || request.headers.has("range")) return "skip";
  }
  if (request.mode === "navigate") return "navigate";
  if (url.pathname.startsWith("/_next/static/")) return "immutable";
  if (STATIC_ASSETS.includes(url.pathname) || STATIC_FILE_PATTERN.test(url.pathname)) return "swr";
  return "skip";
}

function isCacheableResponse(response) {
  if (!response || response.status !== 200 || response.type === "opaque") return false;
  const control = (response.headers.get("Cache-Control") || "").toLowerCase();
  return !/no-store|private/.test(control);
}

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
  if (isCacheableResponse(response)) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const request = event.request;
  const isShellAsset = STATIC_ASSETS.includes(new URL(request.url).pathname);
  const cache = await caches.open(isShellAsset ? STATIC_CACHE : RUNTIME_CACHE);
  const cached = (await cache.match(request)) || (await caches.match(request));

  const refresh = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
        await trimCache(RUNTIME_CACHE, RUNTIME_CACHE_MAX_ENTRIES);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return (await refresh) || Response.error();
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
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

/**
 * Converte o payload do backend nas opções do Notification API. Função pura (testada).
 * - `tag` + `renotify`: a mesma tag substitui a notificação anterior; renotify só vale com tag.
 * - `actions[].url` vira `data.actionUrls`; o clique usa isso para abrir a rota certa.
 * - Só links do próprio app: URLs de outra origem caem em /notificacao.
 */
function buildNotificationOptions(payload, maxActions) {
  const url = normalizeNotificationUrl(payload.url || payload?.data?.url || "/notificacao");
  const tag = payload.tag || payload.deliveryId || "urban-ai-notification";
  const limit = typeof maxActions === "number" ? Math.max(0, Math.min(maxActions, 2)) : 2;
  const rawActions = Array.isArray(payload.actions) && payload.actions.length
    ? payload.actions
    : [{ action: "open", title: "Ver" }];
  const actions = [];
  const actionUrls = {};
  for (const item of rawActions) {
    if (!item || typeof item.action !== "string" || typeof item.title !== "string") continue;
    if (actions.length >= limit) break;
    actions.push({ action: item.action, title: item.title.slice(0, 40) });
    if (typeof item.url === "string" && item.url) actionUrls[item.action] = normalizeNotificationUrl(item.url);
  }
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/pwa-icon-192.png",
    badge: payload.badge || "/pwa-badge-96.png",
    tag,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    lang: "pt-BR",
    timestamp: Number(payload.timestamp) || Date.now(),
    vibrate: [80, 40, 80],
    data: {
      ...(payload.data || {}),
      deliveryId: payload.deliveryId,
      url,
      actionUrls,
    },
    actions,
  };
  const image = normalizeImageUrl(payload.image);
  if (image) options.image = image;
  return { title: payload.title || "Urban AI", options };
}

function normalizeImageUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin === self.location.origin) return `${url.pathname}${url.search}`;
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Alvo do clique, ou null quando não deve abrir nada.
 * "dismiss" fecha; "later" (Aplicar depois) só fecha e mantém o selo de pendente.
 */
function resolveNotificationClickTarget(action, data) {
  if (action === "dismiss" || action === "later") return null;
  const actionUrls = (data && data.actionUrls) || {};
  const fromAction = action && Object.prototype.hasOwnProperty.call(actionUrls, action) ? actionUrls[action] : null;
  return normalizeNotificationUrl(fromAction || (data && data.url) || "/notificacao");
}

async function showUrbanNotification(payload) {
  const { title, options } = buildNotificationOptions(payload, self.Notification?.maxActions);
  await self.registration.showNotification(title, options);
  const count = Number(payload.badgeCount ?? payload?.data?.badgeCount);
  if (Number.isFinite(count) && count >= 0) await setAppBadge(count);
}

async function setAppBadge(count) {
  try {
    const nav = self.navigator;
    if (count > 0 && nav && typeof nav.setAppBadge === "function") await nav.setAppBadge(count);
    else if (nav && typeof nav.clearAppBadge === "function") await nav.clearAppBadge();
  } catch {
    // Selo é um extra: plataformas sem suporte simplesmente ignoram.
  }
}

async function openOrFocusClient(targetUrl) {
  const normalizedPath = normalizeNotificationUrl(targetUrl);
  const absoluteUrl = new URL(normalizedPath, self.location.origin).href;
  const windows = (await clients.matchAll({ type: "window", includeUncontrolled: true })).filter(
    (client) => new URL(client.url).origin === self.location.origin
  );
  // Prefere a janela em foco/visível; senão a primeira do app.
  const client =
    windows.find((item) => item.focused) || windows.find((item) => item.visibilityState === "visible") || windows[0];

  if (client) {
    // focus() primeiro: precisa rodar dentro da janela de ativação do clique (iOS é estrito).
    const focused = await client.focus().catch(() => client);
    const current = new URL(client.url);
    if (`${current.pathname}${current.search}` !== normalizedPath.split("#")[0] && "navigate" in client) {
      try {
        return await (focused || client).navigate(absoluteUrl);
      } catch {
        client.postMessage({ type: "URBAN_NAVIGATE", url: normalizedPath });
        return focused;
      }
    }
    return focused;
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
