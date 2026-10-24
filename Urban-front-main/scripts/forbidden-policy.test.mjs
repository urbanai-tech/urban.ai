import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/service/api/forbidden-policy.ts"),
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

const policy = await loadModule();
const err = (status, code) => ({ response: { status, data: code ? { code } : {} } });

test("403 de quota é de negócio e não vai para /forbidden", () => {
  assert.equal(policy.getBusinessForbiddenCode(err(403, "LISTINGS_QUOTA_EXCEEDED")), "LISTINGS_QUOTA_EXCEEDED");
  assert.equal(policy.isBusinessForbidden(err(403, "LISTINGS_QUOTA_EXCEEDED")), true);
});

test("403 de e-mail não verificado é de negócio", () => {
  assert.equal(policy.getBusinessForbiddenCode(err(403, "EMAIL_NOT_VERIFIED")), "EMAIL_NOT_VERIFIED");
});

test("403 de autorização real (sem code ou code desconhecido) segue para /forbidden", () => {
  assert.equal(policy.isBusinessForbidden(err(403)), false);
  assert.equal(policy.isBusinessForbidden(err(403, "ALGUM_OUTRO_CODE")), false);
});

test("code conhecido em status diferente de 403 não conta", () => {
  assert.equal(policy.isBusinessForbidden(err(400, "LISTINGS_QUOTA_EXCEEDED")), false);
  assert.equal(policy.isBusinessForbidden(null), false);
  assert.equal(policy.isBusinessForbidden(new Error("offline")), false);
});

test("o interceptor usa a política e não redireciona 403 de negócio", () => {
  const client = readFileSync(resolve(process.cwd(), "src/app/service/api/client.ts"), "utf8");
  assert.match(client, /getBusinessForbiddenCode\(error\)/);
  assert.match(client, /status === 403 && !businessCode/);
});
