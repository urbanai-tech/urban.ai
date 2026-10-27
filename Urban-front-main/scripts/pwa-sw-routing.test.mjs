import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const ORIGIN = "https://app.urban.test";

function loadServiceWorker({ windows = [], badgeCalls = [], shown = [] } = {}) {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  const listeners = {};
  const opened = [];
  const sandbox = {
    URL,
    Response,
    Request: class FakeRequest {
      constructor(url, init) {
        this.url = url;
        this.init = init;
      }
    },
    console,
    Headers,
    caches: { open: async () => ({ put: async () => {}, delete: async () => true, match: async () => undefined }) },
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async (url) => void opened.push(url),
    },
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type, fn) => {
        listeners[type] = fn;
      },
      skipWaiting: () => {
        sandbox.__skipped = (sandbox.__skipped ?? 0) + 1;
        return Promise.resolve();
      },
      clients: { claim: async () => {}, matchAll: async () => windows },
      registration: { showNotification: async (title, options) => void shown.push({ title, options }) },
      navigator: {
        setAppBadge: async (n) => void badgeCalls.push(["set", n]),
        clearAppBadge: async () => void badgeCalls.push(["clear"]),
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { sandbox, listeners, opened };
}

const sw = loadServiceWorker();
const req = (path, init = {}) => ({
  method: "GET",
  mode: "no-cors",
  cache: "default",
  headers: new Headers(init.headers),
  ...init.props,
  url: `${init.origin ?? ORIGIN}${path}`,
});
const route = (path, init) => {
  const request = req(path, init);
  return sw.sandbox.routeRequest(request, new URL(request.url));
};

test("roteamento: navegação usa rede primeiro; nunca interfere em API, POST ou outra origem", () => {
  assert.equal(route("/dashboard", { props: { mode: "navigate" } }), "navigate");
  assert.equal(route("/api/auth/session"), "skip");
  assert.equal(route("/_next/data/abc/x.json"), "skip");
  assert.equal(route("/dashboard", { props: { method: "POST", mode: "navigate" } }), "skip");
  assert.equal(route("/logo.png", { origin: "https://cdn.evil.test" }), "skip");
  assert.equal(route("/pwa-icon-192.png", { headers: { Authorization: "Bearer x" } }), "skip");
  assert.equal(route("/video.png", { headers: { Range: "bytes=0-1" } }), "skip");
});

test("roteamento: estáticos hasheados são imutáveis e imagens/fontes usam stale-while-revalidate", () => {
  assert.equal(route("/_next/static/chunks/app-123.js"), "immutable");
  assert.equal(route("/pwa-icon-192.png"), "swr");
  assert.equal(route("/splash/apple-splash-1170x2532.png"), "swr");
  assert.equal(route("/fonts/x.woff2"), "swr");
  assert.equal(route("/manifest.webmanifest"), "swr");
  // JSON/HTML genéricos e rotas de dados não são cacheados.
  assert.equal(route("/locales/pt.json"), "skip");
  assert.equal(route("/dashboard"), "skip");
});

test("respostas com no-store/private ou opacas não entram no cache", () => {
  const ok = (headers = {}, type = "basic", status = 200) => ({ status, type, headers: new Headers(headers) });
  assert.equal(sw.sandbox.isCacheableResponse(ok()), true);
  assert.equal(sw.sandbox.isCacheableResponse(ok({ "Cache-Control": "no-store" })), false);
  assert.equal(sw.sandbox.isCacheableResponse(ok({ "Cache-Control": "private, max-age=0" })), false);
  assert.equal(sw.sandbox.isCacheableResponse(ok({}, "opaque")), false);
  assert.equal(sw.sandbox.isCacheableResponse(ok({}, "basic", 404)), false);
});

test("skipWaiting só acontece por mensagem da própria origem", async () => {
  const { sandbox, listeners } = loadServiceWorker();
  const dispatch = async (origin) => {
    const pending = [];
    listeners.message({ origin, data: { type: "URBAN_SKIP_WAITING" }, waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
  };
  await dispatch("https://evil.example");
  assert.equal(sandbox.__skipped ?? 0, 0);
  await dispatch(ORIGIN);
  assert.equal(sandbox.__skipped, 1);
});

test("install não chama skipWaiting numa atualização (há worker ativo)", async () => {
  const run = async (active) => {
    const { sandbox, listeners } = loadServiceWorker();
    sandbox.self.registration.active = active;
    sandbox.caches.open = async () => ({ add: async () => {} });
    const pending = [];
    listeners.install({ waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
    return sandbox.__skipped ?? 0;
  };
  assert.equal(await run({}), 0);
  assert.equal(await run(null), 1);
});

test("activate remove caches antigos mas preserva o cache do push", async () => {
  const { sandbox, listeners } = loadServiceWorker();
  const deleted = [];
  sandbox.caches.keys = async () => [
    "urban-ai-pwa-v4-static",
    "urban-ai-pwa-v5-static",
    "urban-ai-pwa-v5-runtime",
    "urban-ai-pwa-v4-push-config",
    "outro-app-cache",
  ];
  sandbox.caches.delete = async (key) => void deleted.push(key);
  const pending = [];
  listeners.activate({ waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  assert.deepEqual(deleted, ["urban-ai-pwa-v4-static"]);
});

test("notificação: tag, renotify, ações e deep links viram opções do Notification API", () => {
  const { options, title } = sw.sandbox.buildNotificationOptions(
    {
      title: "Nova recomendação",
      body: "Sábado: R$ 480",
      url: `${ORIGIN}/dashboard?source=push#x`,
      tag: "pricing-2026-10-26",
      renotify: true,
      image: "https://cdn.urban.test/preview.png",
      actions: [
        { action: "view", title: "Ver recomendação", url: "/dashboard?imovel=1" },
        { action: "later", title: "Aplicar depois" },
        { action: "third", title: "Terceira" },
      ],
      data: { type: "pricing_recommendation" },
      deliveryId: "d-1",
    },
    2,
  );
  assert.equal(title, "Nova recomendação");
  assert.equal(options.tag, "pricing-2026-10-26");
  assert.equal(options.renotify, true);
  assert.equal(options.image, "https://cdn.urban.test/preview.png");
  assert.equal(options.actions.length, 2);
  assert.equal(options.data.url, "/dashboard?source=push#x");
  assert.deepEqual(JSON.parse(JSON.stringify(options.data.actionUrls)), { view: "/dashboard?imovel=1" });
  assert.equal(options.badge, "/pwa-badge-96.png");
});

test("notificação: limita ações ao que a plataforma suporta e rejeita URLs de outra origem", () => {
  const built = sw.sandbox.buildNotificationOptions(
    { title: "x", url: "https://evil.example/phish", image: "http://insecure.example/a.png", actions: [{ action: "a", title: "A" }, { action: "b", title: "B" }] },
    1,
  );
  assert.equal(built.options.actions.length, 1);
  assert.equal(built.options.data.url, "/notificacao");
  assert.equal(built.options.image, undefined);
  const noActions = sw.sandbox.buildNotificationOptions({ title: "x" }, 0);
  assert.equal(noActions.options.actions.length, 0);
});

test("clique: ação mapeada abre a rota da ação; 'later' e 'dismiss' só fecham", () => {
  const data = { url: "/dashboard", actionUrls: { view: "/dashboard?imovel=1" } };
  assert.equal(sw.sandbox.resolveNotificationClickTarget("", data), "/dashboard");
  assert.equal(sw.sandbox.resolveNotificationClickTarget("view", data), "/dashboard?imovel=1");
  assert.equal(sw.sandbox.resolveNotificationClickTarget("desconhecida", data), "/dashboard");
  assert.equal(sw.sandbox.resolveNotificationClickTarget("later", data), null);
  assert.equal(sw.sandbox.resolveNotificationClickTarget("dismiss", data), null);
  assert.equal(sw.sandbox.resolveNotificationClickTarget("", undefined), "/notificacao");
  assert.equal(sw.sandbox.resolveNotificationClickTarget("", { url: "https://evil.example/x" }), "/notificacao");
});

test("clique: foca janela aberta (sem recarregar se já está na rota) ou abre uma nova", async () => {
  const calls = [];
  const makeClient = (url, extra = {}) => ({
    url: `${ORIGIN}${url}`,
    focused: false,
    visibilityState: "hidden",
    focus: async function focus() {
      calls.push(["focus", url]);
      return this;
    },
    navigate: async function navigate(to) {
      calls.push(["navigate", to]);
      return this;
    },
    postMessage: () => {},
    ...extra,
  });

  const same = loadServiceWorker({ windows: [makeClient("/dashboard")] });
  await same.sandbox.openOrFocusClient("/dashboard");
  assert.deepEqual(calls.splice(0), [["focus", "/dashboard"]]);

  const other = loadServiceWorker({
    windows: [makeClient("/painel"), makeClient("/portfolio", { visibilityState: "visible" })],
  });
  await other.sandbox.openOrFocusClient("/notificacao");
  assert.deepEqual(calls.splice(0), [["focus", "/portfolio"], ["navigate", `${ORIGIN}/notificacao`]]);

  const none = loadServiceWorker({ windows: [] });
  await none.sandbox.openOrFocusClient("/dashboard?x=1");
  assert.deepEqual(none.opened, [`${ORIGIN}/dashboard?x=1`]);
});

test("push: exibe com tag/ações e atualiza o selo do app com badgeCount", async () => {
  const badgeCalls = [];
  const shown = [];
  const { sandbox } = loadServiceWorker({ badgeCalls, shown });
  await sandbox.showUrbanNotification({ title: "Preço", tag: "t", badgeCount: 3 });
  assert.equal(shown.length, 1);
  assert.deepEqual(badgeCalls, [["set", 3]]);
  await sandbox.showUrbanNotification({ title: "Sem contagem", tag: "t2" });
  assert.deepEqual(badgeCalls, [["set", 3]]);
  await sandbox.showUrbanNotification({ title: "Zerou", badgeCount: 0 });
  assert.deepEqual(badgeCalls, [["set", 3], ["clear"]]);
});
