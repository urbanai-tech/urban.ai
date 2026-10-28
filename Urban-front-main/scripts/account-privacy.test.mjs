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

test("safeErrorSummary loga só status e mensagem, nunca o corpo da requisição", () => {
  const axiosLike = Object.assign(new Error("Request failed with status code 400"), {
    response: { status: 400 },
    config: { data: JSON.stringify({ password: "Senha#Secreta1" }) },
  });
  const summary = mod.safeErrorSummary(axiosLike);
  assert.equal(summary, "HTTP 400: Request failed with status code 400");
  assert.doesNotMatch(summary, /Senha#Secreta1/);
  assert.equal(mod.safeErrorSummary("x"), "erro desconhecido");
});

test("nenhum fluxo de senha faz hash no navegador (senha em claro sob TLS; ADR 0025)", () => {
  const files = [
    "src/app/(home)/page.tsx",
    "src/app/create/page.tsx",
    "src/app/reset-password/page.tsx",
    "src/app/waitlist/aceitar/page.tsx",
    "src/app/profile/page.tsx",
    "src/app/service/api/auth.ts",
    "src/app/lib/account-privacy.ts",
  ];
  for (const file of files) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, /crypto\.subtle|sha256|SHA-256|hashedPassword/i, file);
  }
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
  assert.match(auth, /api\.delete\("\/auth\/me", \{ data: \{ password \} \}\)/);
  assert.match(auth, /api\.get<Record<string, unknown>>\("\/auth\/me\/export"\)/);
});

test("página de privacidade não usa o guard de assinatura (direitos LGPD independem de plano)", () => {
  const layout = readFileSync(resolve(process.cwd(), "src/app/settings/privacy/layout.tsx"), "utf8");
  assert.match(layout, /<HostShell guard=\{false\}>/);
});
