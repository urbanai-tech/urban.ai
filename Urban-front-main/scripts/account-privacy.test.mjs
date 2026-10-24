import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/account-privacy.ts"), "utf8");
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

test("sha256Hex gera o mesmo hash do login (hex de 64 caracteres)", async () => {
  assert.equal(
    await mod.sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("nome do arquivo de exportação usa a data ISO", () => {
  assert.equal(mod.exportFileName(new Date("2026-10-24T12:00:00Z")), "urbanai-meus-dados-2026-10-24.json");
});

test("serializeExport devolve JSON legível e reversível", () => {
  const bundle = { format: "urban-ai-data-export/v1", user: { id: "u1" } };
  assert.deepEqual(JSON.parse(mod.serializeExport(bundle)), bundle);
  assert.match(mod.serializeExport(bundle), /\n {2}"user"/);
});

test("mensagens de erro da exclusão seguem o code do backend", () => {
  const err = (code, message) => ({ response: { status: 400, data: { code, message } } });
  assert.match(mod.deleteAccountErrorMessage(err("INVALID_PASSWORD")), /Senha incorreta/);
  assert.match(mod.deleteAccountErrorMessage(err("PASSWORD_REQUIRED")), /senha atual/);
  assert.equal(
    mod.deleteAccountErrorMessage({ response: { status: 503, data: { code: "SUBSCRIPTION_CANCEL_FAILED", message: "Msg do backend" } } }),
    "Msg do backend",
  );
  assert.match(mod.deleteAccountErrorMessage(new Error("offline")), /Tente novamente/);
});

test("API da exclusão envia a senha no corpo do DELETE e a exportação usa GET /auth/me/export", () => {
  const auth = readFileSync(resolve(process.cwd(), "src/app/service/api/auth.ts"), "utf8");
  assert.match(auth, /api\.delete\("\/auth\/me", \{ data: \{ password: await sha256Hex\(password\) \} \}\)/);
  assert.match(auth, /api\.get<Record<string, unknown>>\("\/auth\/me\/export"\)/);
});

test("página de privacidade não usa o guard de assinatura (direitos LGPD independem de plano)", () => {
  const layout = readFileSync(resolve(process.cwd(), "src/app/settings/privacy/layout.tsx"), "utf8");
  assert.match(layout, /<HostShell guard=\{false\}>/);
});
