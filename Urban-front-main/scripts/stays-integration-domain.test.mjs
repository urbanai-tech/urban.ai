import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadDomainModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/settings/integrations/stays-integration-domain.ts"),
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

const domain = await loadDomainModule();

test("normalizeStaysAccountSlug aceita só o identificador da conta *.stays.net", () => {
  assert.equal(domain.normalizeStaysAccountSlug("minhaconta"), "minhaconta");
  assert.equal(domain.normalizeStaysAccountSlug("  MinhaConta  "), "minhaconta");
  assert.equal(domain.normalizeStaysAccountSlug("minha-conta.stays.net"), "minha-conta");
  assert.equal(domain.normalizeStaysAccountSlug("https://minhaconta.stays.net/external/v1"), "minhaconta");
  assert.equal(domain.normalizeStaysAccountSlug(""), null);
  assert.equal(domain.normalizeStaysAccountSlug(null), null);
  for (const bad of [
    "https://evil.example",
    "minhaconta.stays.net.evil.example",
    "http://minhaconta.stays.net",
    "ftp://minhaconta.stays.net",
    "minhaconta.stays.net:8443",
    "user@minhaconta.stays.net",
    "a.b.stays.net",
    "-conta",
    "conta-",
    "x".repeat(64),
    "conta_1",
  ]) {
    assert.equal(domain.normalizeStaysAccountSlug(bad), null, bad);
  }
});

test("canRollback só libera push aplicado sem reversão aplicada/em andamento", () => {
  const applied = { id: "a", origin: "user_accepted", status: "success" };
  assert.equal(domain.canRollback(applied, [applied]), true);
  assert.equal(domain.canRollback({ ...applied, status: "error" }, []), false);
  assert.equal(domain.canRollback({ id: "r", origin: "rollback", status: "success", rollbackOfId: "x" }, []), false);
  const failedRollback = { id: "r1", origin: "rollback", status: "error", rollbackOfId: "a" };
  assert.equal(domain.canRollback(applied, [applied, failedRollback]), true, "reversão que falhou pode ser repetida");
  const pending = { id: "r2", origin: "rollback", status: "pending", rollbackOfId: "a" };
  assert.equal(domain.canRollback(applied, [applied, pending]), false);
  const done = { id: "r3", origin: "rollback", status: "success", rollbackOfId: "a" };
  assert.equal(domain.canRollback(applied, [applied, done]), false);
});

test("rótulos e badges de PriceUpdate", () => {
  assert.equal(domain.priceUpdateStatusLabel("success"), "Aplicado");
  assert.equal(domain.priceUpdateStatusLabel("error"), "Falhou (pode tentar de novo)");
  assert.equal(domain.priceUpdateOriginLabel("rollback"), "Reversão");
  assert.equal(domain.priceUpdateOriginLabel("ai_auto"), "Automático");
  assert.equal(domain.priceUpdateBadgeKind("success"), "success");
  assert.equal(domain.priceUpdateBadgeKind("rejected"), "warn");
  assert.equal(domain.priceUpdateBadgeKind("error"), "error");
  assert.equal(domain.priceUpdateBadgeKind("pending"), "neutral");
});

test("newStaysRequestId gera UUID v4 distinto a cada decisão", () => {
  const a = domain.newStaysRequestId();
  const b = domain.newStaysRequestId();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
});

test("centsToReaisInput e mensagem de escrita desligada", () => {
  assert.equal(domain.centsToReaisInput(12345), "123.45");
  assert.equal(domain.centsToReaisInput(null), "");
  assert.equal(domain.centsToReaisInput(0), "");
  assert.equal(domain.STAYS_WRITES_DISABLED_MESSAGE, "Escrita desligada neste ambiente");
});
