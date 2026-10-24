import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/context/subscription-status.ts"),
    "utf8",
  );
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

const mod = await loadModule();

test("assinatura active/trialing é ativa; null, vazia ou outro status é inativa", () => {
  assert.equal(mod.classifySubscription({ status: "active" }), "active");
  assert.equal(mod.classifySubscription({ status: "trialing" }), "active");
  assert.equal(mod.classifySubscription(null), "inactive");
  assert.equal(mod.classifySubscription(""), "inactive");
  assert.equal(mod.classifySubscription({ status: "canceled" }), "inactive");
  assert.equal(mod.classifySubscription({ status: "past_due" }), "inactive");
});

test("erro de rede e 5xx/429 são 'unknown' (sem paywall); 404 é inativo definitivo", () => {
  assert.equal(mod.classifySubscriptionError(new Error("Network Error")), "unknown");
  assert.equal(mod.classifySubscriptionError({ response: { status: 500 } }), "unknown");
  assert.equal(mod.classifySubscriptionError({ response: { status: 503 } }), "unknown");
  assert.equal(mod.classifySubscriptionError({ response: { status: 429 } }), "unknown");
  assert.equal(mod.classifySubscriptionError({ response: { status: 404 } }), "inactive");
});

test("cache respeita TTL e nunca guarda 'unknown'", () => {
  mod.invalidateSubscriptionCache();
  assert.equal(mod.getCachedSubscriptionVerdict(1_000), null);

  mod.setCachedSubscriptionVerdict("unknown", 1_000);
  assert.equal(mod.getCachedSubscriptionVerdict(1_001), null);

  mod.setCachedSubscriptionVerdict("active", 1_000);
  assert.equal(mod.getCachedSubscriptionVerdict(1_000 + mod.SUBSCRIPTION_ACTIVE_TTL_MS - 1), "active");
  assert.equal(mod.getCachedSubscriptionVerdict(1_000 + mod.SUBSCRIPTION_ACTIVE_TTL_MS + 1), null);

  mod.setCachedSubscriptionVerdict("inactive", 5_000);
  assert.equal(mod.getCachedSubscriptionVerdict(5_000 + mod.SUBSCRIPTION_INACTIVE_TTL_MS - 1), "inactive");
  assert.equal(mod.getCachedSubscriptionVerdict(5_000 + mod.SUBSCRIPTION_INACTIVE_TTL_MS + 1), null);

  mod.setCachedSubscriptionVerdict("active", 9_000);
  mod.invalidateSubscriptionCache();
  assert.equal(mod.getCachedSubscriptionVerdict(9_001), null);
});

test("sessão: cache curto e só 401/403 contam como falha definitiva", () => {
  mod.invalidateAuthCache();
  assert.equal(mod.isAuthRecentlyVerified(1_000), false);
  mod.markAuthVerified(1_000);
  assert.equal(mod.isAuthRecentlyVerified(1_000 + mod.AUTH_OK_TTL_MS - 1), true);
  assert.equal(mod.isAuthRecentlyVerified(1_000 + mod.AUTH_OK_TTL_MS + 1), false);

  assert.equal(mod.isDefinitiveAuthFailure({ response: { status: 401 } }), true);
  assert.equal(mod.isDefinitiveAuthFailure({ response: { status: 403 } }), true);
  assert.equal(mod.isDefinitiveAuthFailure({ response: { status: 500 } }), false);
  assert.equal(mod.isDefinitiveAuthFailure(new Error("Network Error")), false);
});

test("guards não devolvem null enquanto carregam e só abrem paywall com veredito 'inactive'", () => {
  const payment = readFileSync(resolve(process.cwd(), "src/app/context/PaymentCheckGuard.tsx"), "utf8");
  assert.doesNotMatch(payment, /return null/);
  assert.match(payment, /isOpen=\{verdict === 'inactive'\}/);
  const auth = readFileSync(resolve(process.cwd(), "src/app/context/AuthGuard.tsx"), "utf8");
  assert.doesNotMatch(auth, /return null/);
});
