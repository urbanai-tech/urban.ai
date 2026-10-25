import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

async function loadStorageModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/service/pwaPushStorage.ts"), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const storage = await loadStorageModule();

test("toPersistedDeviceRef nunca serializa o secret, mesmo que o objeto o carregue", () => {
  const json = storage.toPersistedDeviceRef({
    apiBaseUrl: "https://api.example.com",
    deviceId: "dev-1",
    secret: "s3gredo",
  });
  assert.deepEqual(JSON.parse(json), { apiBaseUrl: "https://api.example.com", deviceId: "dev-1" });
  assert.ok(!json.includes("s3gredo"));
});

test("parseStoredDevice lê a referência nova e não devolve secret", () => {
  const parsed = storage.parseStoredDevice(JSON.stringify({ apiBaseUrl: "", deviceId: "dev-1" }));
  assert.deepEqual(parsed, { ref: { apiBaseUrl: "", deviceId: "dev-1" }, legacySecret: null });
});

test("parseStoredDevice expõe o secret legado só para migração", () => {
  const parsed = storage.parseStoredDevice(JSON.stringify({ apiBaseUrl: "x", deviceId: "d", secret: "old" }));
  assert.equal(parsed.ref.deviceId, "d");
  assert.equal(parsed.legacySecret, "old");
});

test("parseStoredDevice tolera lixo e ausência", () => {
  assert.deepEqual(storage.parseStoredDevice(null).ref, null);
  assert.deepEqual(storage.parseStoredDevice("{nao-json").ref, null);
  assert.deepEqual(storage.parseStoredDevice("{}").ref, null);
});

test("pwaPush.ts não grava o secret no localStorage", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/service/pwaPush.ts"), "utf8");
  assert.ok(!/localStorage\.setItem\([^)]*secret/.test(source));
  assert.ok(source.includes("storeConfig({ apiBaseUrl: deviceConfig.apiBaseUrl, deviceId: deviceConfig.deviceId })"));
});

function loadServiceWorkerMessageHandler() {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  const listeners = {};
  const cachePuts = [];
  const sandbox = {
    URL,
    Response,
    Request,
    console,
    caches: {
      open: async () => ({
        put: async (...args) => cachePuts.push(args),
        delete: async () => true,
        match: async () => undefined,
      }),
    },
    self: {
      location: { origin: "https://app.urban.test" },
      addEventListener: (type, fn) => {
        listeners[type] = fn;
      },
      skipWaiting: () => {},
      clients: { claim: async () => {}, matchAll: async () => [] },
      registration: {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { handler: listeners.message, cachePuts };
}

async function dispatch(handler, origin, data) {
  const pending = [];
  handler({ origin, data, waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
}

test("sw.js ignora mensagem de outra origem", async () => {
  const { handler, cachePuts } = loadServiceWorkerMessageHandler();
  assert.equal(typeof handler, "function");
  await dispatch(handler, "https://evil.example", {
    type: "URBAN_PUSH_CONFIG",
    config: { deviceId: "d", secret: "s" },
  });
  assert.equal(cachePuts.length, 0);
});

test("sw.js aceita mensagem da própria origem", async () => {
  const { handler, cachePuts } = loadServiceWorkerMessageHandler();
  await dispatch(handler, "https://app.urban.test", {
    type: "URBAN_PUSH_CONFIG",
    config: { deviceId: "d", secret: "s" },
  });
  assert.equal(cachePuts.length, 1);
});
