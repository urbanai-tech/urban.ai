import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/context/logout-push-cleanup.ts"), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const mod = await loadModule();

test("chama o unsubscribe do push e informa sucesso", async () => {
  let called = 0;
  const ok = await mod.cancelPushOnLogout(async () => {
    called += 1;
  });
  assert.equal(called, 1);
  assert.equal(ok, true);
});

test("erro no unsubscribe não propaga (logout segue)", async () => {
  const ok = await mod.cancelPushOnLogout(async () => {
    throw new Error("rede caiu");
  });
  assert.equal(ok, false);
});

test("unsubscribe lento é abandonado no limite de tempo (não bloqueia o logout)", async () => {
  const startedAt = Date.now();
  const ok = await mod.cancelPushOnLogout(() => new Promise(() => {}), 50);
  assert.equal(ok, false);
  assert.ok(Date.now() - startedAt < 1_000);
});

test("AuthContext cancela o push antes de chamar /auth/logout", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/context/AuthContext.tsx"), "utf8");
  const unsubscribeAt = source.indexOf("cancelPushOnLogout(unsubscribeFromPwaPush)");
  const logoutAt = source.indexOf("api.post('/auth/logout')");
  assert.ok(unsubscribeAt > 0, "logout deve cancelar o push");
  assert.ok(logoutAt > unsubscribeAt, "o push deve ser cancelado enquanto a sessão ainda é válida");
});
