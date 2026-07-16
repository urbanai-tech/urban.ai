import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadFocusDomain() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/componentes/ui/dialog-focus.ts"),
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

const focusDomain = await loadFocusDomain();
const target = (name) => ({ name, focus() {} });

test("Tab e Shift+Tab ciclam nas duas extremidades do dialog", () => {
  const first = target("first");
  const middle = target("middle");
  const last = target("last");
  const focusables = [first, middle, last];

  assert.equal(focusDomain.resolveDialogTabTarget(focusables, last, false), first);
  assert.equal(focusDomain.resolveDialogTabTarget(focusables, first, true), last);
  assert.equal(focusDomain.resolveDialogTabTarget(focusables, middle, false), null);
});

test("foco fora do dialog entra pela extremidade coerente", () => {
  const first = target("first");
  const last = target("last");
  const outside = target("outside");

  assert.equal(focusDomain.resolveDialogTabTarget([first, last], outside, false), first);
  assert.equal(focusDomain.resolveDialogTabTarget([first, last], outside, true), last);
  assert.equal(focusDomain.resolveDialogTabTarget([], outside, false), null);
});

test("todos os dialogs e drawers usam o primitive compartilhado", () => {
  const files = [
    "src/app/componentes/ui/AppConfirmDialog.tsx",
    "src/app/admin/_components/AdminConfirmDialog.tsx",
    "src/app/admin/_components/AdminDrawer.tsx",
    "src/app/componentes/ui/AskUrbanDrawer.tsx",
  ];

  for (const file of files) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /useDialogFocus\(\{/);
    assert.match(source, /tabIndex=\{-1\}/);
  }

  const hook = readFileSync(
    resolve(process.cwd(), "src/app/componentes/ui/useDialogFocus.ts"),
    "utf8",
  );
  assert.match(hook, /event\.key === "Escape"/);
  assert.match(hook, /resolveDialogTabTarget/);
  assert.match(hook, /previouslyFocused\.focus\(\)/);
});

test("botões canônicos preservam contexto no loading e expõem estado acessível", () => {
  for (const file of [
    "src/app/componentes/ui/AppButton.tsx",
    "src/app/admin/_components/AdminButton.tsx",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /urban-canonical-button/);
    assert.match(source, /aria-busy=\{loading \|\| ariaBusy \|\| undefined\}/);
    assert.match(source, /contextualLabel/);
    assert.match(source, /loadingLabel \?\? children/);
  }

  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  assert.match(css, /\.urban-canonical-button/);
  assert.match(css, /min-inline-size: 44px !important/);
  assert.match(css, /min-block-size: 44px !important/);
});
