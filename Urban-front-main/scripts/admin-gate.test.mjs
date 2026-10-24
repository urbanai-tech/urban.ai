import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/admin-gate.ts"), "utf8");
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

const gate = await loadModule();

test("admin passa (case-insensitive, igual ao SideBar)", () => {
  assert.deepEqual(gate.decideAdminGate({ ok: true, role: "admin" }), { kind: "allow" });
  assert.deepEqual(gate.decideAdminGate({ ok: true, role: "Admin" }), { kind: "allow" });
});

test("host, support e papel ausente vão para /forbidden", () => {
  for (const role of ["host", "support", "", undefined, null, 1]) {
    assert.deepEqual(gate.decideAdminGate({ ok: true, role }), { kind: "forbidden" });
  }
});

test("401 vai para login, 403 para forbidden, rede/5xx pedem nova tentativa (sem afirmar 'não admin')", () => {
  assert.deepEqual(gate.decideAdminGate({ ok: false, status: 401 }), { kind: "login" });
  assert.deepEqual(gate.decideAdminGate({ ok: false, status: 403 }), { kind: "forbidden" });
  assert.deepEqual(gate.decideAdminGate({ ok: false, status: 500 }), { kind: "retry" });
  assert.deepEqual(gate.decideAdminGate({ ok: false, status: null }), { kind: "retry" });
});

test("o layout admin só renderiza o shell dentro do AdminGate", () => {
  const layout = readFileSync(resolve(process.cwd(), "src/app/admin/layout.tsx"), "utf8");
  const gateAt = layout.indexOf("<AdminGate>");
  const shellAt = layout.indexOf("<AdminShell>");
  assert.ok(gateAt > 0 && shellAt > gateAt, "AdminShell deve estar dentro de AdminGate");
});
