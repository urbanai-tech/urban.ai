import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadLifecycleModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/service/pwaLifecycle.ts"), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

class EventHub {
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

function createHarness({ controller = null, readyState = "complete" } = {}) {
  const serviceWorkerHub = new EventHub();
  const documentHub = new EventHub();
  const windowHub = new EventHub();
  const calls = { register: [], update: 0, getRegistration: 0, reload: 0, registered: 0, errors: [] };
  const registration = { update: async () => void calls.update++ };
  const serviceWorker = Object.assign(serviceWorkerHub, {
    controller,
    register: async (url, options) => {
      calls.register.push({ url, options });
      return registration;
    },
    getRegistration: async () => {
      calls.getRegistration++;
      return registration;
    },
  });
  const documentRef = Object.assign(documentHub, { readyState, visibilityState: "visible" });
  const windowRef = Object.assign(windowHub, {
    location: { reload: () => void calls.reload++ },
  });
  return { serviceWorker, documentRef, windowRef, calls };
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

const lifecycle = await loadLifecycleModule();

test("registro evita cache HTTP do script e força checagem de versão", async () => {
  const harness = createHarness();
  lifecycle.setupPwaLifecycle({
    ...harness,
    onRegistered: () => void harness.calls.registered++,
    onError: (error) => harness.calls.errors.push(error),
  });
  await flushPromises();

  assert.deepEqual(harness.calls.register, [
    { url: "/sw.js", options: { scope: "/", updateViaCache: "none" } },
  ]);
  assert.equal(harness.calls.registered, 1);
  assert.equal(harness.calls.update, 1);
  assert.deepEqual(harness.calls.errors, []);
});

test("controller novo recarrega uma única vez somente quando já havia versão ativa", async () => {
  const updateHarness = createHarness({ controller: {} });
  lifecycle.setupPwaLifecycle(updateHarness);
  updateHarness.serviceWorker.emit("controllerchange");
  updateHarness.serviceWorker.emit("controllerchange");
  assert.equal(updateHarness.calls.reload, 1);

  const firstInstallHarness = createHarness({ controller: null });
  lifecycle.setupPwaLifecycle(firstInstallHarness);
  firstInstallHarness.serviceWorker.emit("controllerchange");
  assert.equal(firstInstallHarness.calls.reload, 0);
  await flushPromises();
});

test("retorno à aba e reconexão procuram atualização sem chamadas concorrentes", async () => {
  const harness = createHarness();
  const dispose = lifecycle.setupPwaLifecycle(harness);
  await flushPromises();
  const initialUpdates = harness.calls.update;

  harness.documentRef.visibilityState = "hidden";
  harness.documentRef.emit("visibilitychange");
  assert.equal(harness.calls.getRegistration, 0);

  harness.documentRef.visibilityState = "visible";
  harness.documentRef.emit("visibilitychange");
  harness.windowRef.emit("online");
  await flushPromises();
  assert.equal(harness.calls.getRegistration, 1);
  assert.equal(harness.calls.update, initialUpdates + 1);

  dispose();
  harness.windowRef.emit("online");
  harness.serviceWorker.emit("controllerchange");
  await flushPromises();
  assert.equal(harness.calls.getRegistration, 1);
  assert.equal(harness.calls.reload, 0);
});

test("service worker versiona caches e remove apenas versões antigas da Urban AI", () => {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  assert.match(source, /const CACHE_PREFIX = ["']urban-ai-pwa-["']/);
  assert.match(source, /const CACHE_VERSION = `\$\{CACHE_PREFIX\}v4`/);
  assert.match(source, /const ACTIVE_CACHES = new Set\(\[STATIC_CACHE, PUSH_CONFIG_CACHE\]\)/);
  assert.match(source, /key\.startsWith\(CACHE_PREFIX\) && !ACTIVE_CACHES\.has\(key\)/);
  assert.match(source, /cache\.add\(new Request\(["']\/offline\.html["'], \{ cache: ["']reload["'] \}\)\)/);
});
