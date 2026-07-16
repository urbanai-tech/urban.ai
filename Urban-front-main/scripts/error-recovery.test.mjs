import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadRecoveryModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/componentes/errors/error-recovery.ts"),
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

const recovery = await loadRecoveryModule();

test("Enter recupera uma vez e cancela a ação nativa", () => {
  let prevented = 0;
  let resets = 0;
  const handled = recovery.recoverFromKeyboard(
    { key: "Enter", preventDefault: () => prevented++ },
    () => resets++,
  );

  assert.equal(handled, true);
  assert.equal(prevented, 1);
  assert.equal(resets, 1);
});

test("Espaço recupera, mas repetição de tecla não duplica reset", () => {
  let resets = 0;
  assert.equal(
    recovery.recoverFromKeyboard({ key: " ", preventDefault() {} }, () => resets++),
    true,
  );
  assert.equal(
    recovery.recoverFromKeyboard({ key: " ", repeat: true, preventDefault() {} }, () => resets++),
    false,
  );
  assert.equal(resets, 1);
});

test("teclas sem ação preservam o comportamento padrão", () => {
  let prevented = 0;
  let resets = 0;
  assert.equal(
    recovery.recoverFromKeyboard({ key: "Escape", preventDefault: () => prevented++ }, () => resets++),
    false,
  );
  assert.equal(prevented, 0);
  assert.equal(resets, 0);
});

test("boundaries público, host e admin usam o estado recuperável compartilhado", () => {
  const contracts = [
    ["src/app/error.tsx", "host"],
    ["src/app/(public)/error.tsx", "public"],
    ["src/app/admin/error.tsx", "admin"],
  ];

  for (const [file, domain] of contracts) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, new RegExp(`DomainErrorState domain=["']${domain}["']`));
    assert.match(source, /reset=\{reset\}/);
  }

  const shared = readFileSync(
    resolve(process.cwd(), "src/app/componentes/errors/DomainErrorState.tsx"),
    "utf8",
  );
  assert.match(shared, /onClick=\{reset\}/);
  assert.match(shared, /recoverFromKeyboard\(event, reset\)/);
  assert.match(shared, /autoFocus/);
  assert.match(shared, /role="alert"/);
  assert.match(shared, /:focus-visible/);
});
