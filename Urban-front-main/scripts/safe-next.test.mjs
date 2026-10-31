import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/safe-next.ts"), "utf8");
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

const { safeNextPath, nextFromSearch } = await loadModule();

test("aceita caminhos internos, com query e fragmento", () => {
  assert.equal(safeNextPath("/plans"), "/plans");
  assert.equal(safeNextPath("/properties?tab=1#x"), "/properties?tab=1#x");
  assert.equal(safeNextPath("  /my-plan "), "/my-plan");
});

test("recusa externos, protocol-relative, esquemas e barra invertida", () => {
  for (const bad of [
    "//evil.com",
    "https://evil.com",
    "http://evil.com/x",
    "javascript:alert(1)",
    "evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/a\nb",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeNextPath(bad), null, String(bad));
  }
});

test("recusa rotas de autenticação para evitar laço", () => {
  for (const bad of ["/", "/login", "/login/", "/post-login", "/post-login?next=/plans", "/?next=/plans"]) {
    assert.equal(safeNextPath(bad), null, bad);
  }
});

test("nextFromSearch decodifica e valida", () => {
  assert.equal(nextFromSearch("?next=%2Fplans"), "/plans");
  assert.equal(nextFromSearch("?next=%2F%2Fevil.com"), null);
  assert.equal(nextFromSearch("?x=1"), null);
  assert.equal(nextFromSearch(""), null);
});
