import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/sidebar-auth.ts"), "utf8");
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

const auth = await loadModule();

test("só 401 redireciona para o login", () => {
  assert.equal(auth.shouldRedirectToLogin(401), true);
});

test("rede (sem status), 5xx e 403 NÃO deslogam: mostram nova tentativa", () => {
  for (const status of [null, undefined, 0, 403, 500, 502, 503, 504]) {
    assert.equal(auth.shouldRedirectToLogin(status), false, `status ${status}`);
  }
});

test("SideBar usa o helper e não redireciona em qualquer erro", () => {
  const sidebar = readFileSync(resolve(process.cwd(), "src/app/componentes/SideBar.tsx"), "utf8");
  assert.match(sidebar, /shouldRedirectToLogin\(/);
  assert.doesNotMatch(sidebar, /\.catch\(\(\) => \{\s*localStorage\.removeItem/);
});
