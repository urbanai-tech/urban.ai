import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/auth-links.ts"), "utf8");
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

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
}

test("parseResetTokenFromHash lê o token do fragmento", () => {
  assert.equal(mod.parseResetTokenFromHash("#token=abc_DEF-123"), "abc_DEF-123");
  assert.equal(mod.parseResetTokenFromHash("token=abc"), "abc");
  assert.equal(mod.parseResetTokenFromHash("#token="), null);
  assert.equal(mod.parseResetTokenFromHash("#outro=1"), null);
  assert.equal(mod.parseResetTokenFromHash(""), null);
  assert.equal(mod.parseResetTokenFromHash(undefined), null);
});

test("o e-mail pendente passa por sessionStorage e some ao limpar", () => {
  const storage = memoryStorage();
  assert.equal(mod.readPendingEmail(storage), "");
  mod.stashPendingEmail("  ana@urbanai.com.br ", storage);
  assert.equal(mod.readPendingEmail(storage), "ana@urbanai.com.br");
  mod.clearPendingEmail(storage);
  assert.equal(mod.readPendingEmail(storage), "");
  mod.stashPendingEmail("   ", storage);
  assert.equal(mod.readPendingEmail(storage), "");
});

test("storage indisponível não quebra o fluxo", () => {
  const broken = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.doesNotThrow(() => mod.stashPendingEmail("a@b.co", broken));
  assert.equal(mod.readPendingEmail(broken), "");
  assert.doesNotThrow(() => mod.clearPendingEmail(broken));
  assert.equal(mod.readPendingEmail(null), "");
});

test("maskEmail mascara o local-part e mantém o domínio", () => {
  assert.equal(mod.maskEmail("ana.host@urbanai.com"), "an***@urbanai.com");
  assert.equal(mod.maskEmail("ab@x.co"), "a***@x.co");
  assert.equal(mod.maskEmail(""), "");
  assert.equal(mod.maskEmail("sem-arroba"), "");
  assert.equal(mod.maskEmail(null), "");
});

test("safeDecodeSegment decodifica sem estourar em % inválido", () => {
  assert.equal(mod.safeDecodeSegment("ana%40urbanai.com"), "ana@urbanai.com");
  assert.equal(mod.safeDecodeSegment("%E0%A4%A"), "%E0%A4%A");
  assert.equal(mod.safeDecodeSegment(undefined), "");
});

test("isEmailChange ignora caixa e espaços e não conta campo vazio", () => {
  assert.equal(mod.isEmailChange("ana@x.com", " ANA@x.com "), false);
  assert.equal(mod.isEmailChange("ana@x.com", "bia@x.com"), true);
  assert.equal(mod.isEmailChange("ana@x.com", ""), false);
  assert.equal(mod.isEmailChange(undefined, "bia@x.com"), true);
});

test("emailChangeErrorMessage traduz os códigos do backend", () => {
  const err = (status, code) => ({ response: { status, data: { code } } });
  assert.match(mod.emailChangeErrorMessage(err(400, "INVALID_PASSWORD")), /Senha incorreta/);
  assert.match(mod.emailChangeErrorMessage(err(400, "PASSWORD_REQUIRED")), /senha atual/);
  assert.match(mod.emailChangeErrorMessage(err(400, "EMAIL_CHANGE_NOT_ALLOWED")), /Google/);
  assert.match(mod.emailChangeErrorMessage(err(409)), /já está em uso/);
  assert.match(mod.emailChangeErrorMessage(new Error("x")), /Não foi possível/);
});

test("as telas não montam mais /confirm-email/<email> nem /reset-password/<token>", () => {
  const files = [
    "src/app/(home)/page.tsx",
    "src/app/create/page.tsx",
    "src/app/onboarding/page.tsx",
    "src/app/post-login/page.tsx",
    "src/app/profile/page.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, /confirm-email\/["`$+]/, `${file} ainda monta /confirm-email/<email>`);
    assert.doesNotMatch(source, /reset-password\/["`$+]/, `${file} ainda monta /reset-password/<token>`);
  }
});
