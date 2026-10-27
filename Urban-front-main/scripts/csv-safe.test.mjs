import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/csv-safe.ts"), "utf8");
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

const { csvCell } = await loadModule();

test("csvCell neutraliza células que começam com =, +, -, @, TAB ou CR", () => {
  for (const dangerous of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) {
    assert.equal(csvCell(dangerous), `"'${dangerous}"`);
  }
});

test("csvCell mantém texto normal, vazio e escapa aspas", () => {
  assert.equal(csvCell("Casa Vila Madalena"), '"Casa Vila Madalena"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
  assert.equal(csvCell(247.5), '"247.5"');
  assert.equal(csvCell('diz "oi"'), '"diz ""oi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
});
