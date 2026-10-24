import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/checkout.ts"), "utf8");
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

const checkout = await loadModule();

test("usa a url hospedada do Stripe quando o backend a devolve", () => {
  assert.deepEqual(
    checkout.pickCheckoutRedirect({ sessionId: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }),
    { mode: "url", url: "https://checkout.stripe.com/c/pay/cs_1" },
  );
});

test("cai para o sessionId em respostas antigas sem url (ou com url nula)", () => {
  assert.deepEqual(checkout.pickCheckoutRedirect({ sessionId: "cs_old" }), { mode: "sessionId", sessionId: "cs_old" });
  assert.deepEqual(checkout.pickCheckoutRedirect({ sessionId: "cs_old", url: null }), { mode: "sessionId", sessionId: "cs_old" });
});

test("não redireciona para url fora do Stripe nem para http (open redirect)", () => {
  assert.equal(checkout.isTrustedCheckoutUrl("https://evil.example.com/stripe.com"), false);
  assert.equal(checkout.isTrustedCheckoutUrl("https://checkout.stripe.com.evil.io/x"), false);
  assert.equal(checkout.isTrustedCheckoutUrl("http://checkout.stripe.com/x"), false);
  assert.equal(checkout.isTrustedCheckoutUrl("javascript:alert(1)"), false);
  assert.deepEqual(
    checkout.pickCheckoutRedirect({ sessionId: "cs_2", url: "https://evil.example.com/" }),
    { mode: "sessionId", sessionId: "cs_2" },
  );
});

test("sem url e sem sessionId não há redirecionamento", () => {
  assert.equal(checkout.pickCheckoutRedirect({}), null);
  assert.equal(checkout.pickCheckoutRedirect(null), null);
});

test("interpreta o retorno do checkout em ?checkout=", () => {
  assert.equal(checkout.parseCheckoutReturn("?checkout=success"), "success");
  assert.equal(checkout.parseCheckoutReturn("?source=my-plan&checkout=canceled"), "canceled");
  assert.equal(checkout.parseCheckoutReturn("?checkout=outra-coisa"), null);
  assert.equal(checkout.parseCheckoutReturn(""), null);
});

test("PricingCalculatorV2 redireciona com location.assign e mantém redirectToCheckout só como fallback", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/componentes/PricingCalculatorV2.tsx"), "utf8");
  assert.match(source, /window\.location\.assign\(redirect\.url\)/);
  assert.match(source, /redirect\?\.mode === "sessionId"/);
  const assignAt = source.indexOf("window.location.assign");
  const legacyAt = source.indexOf("stripe.redirectToCheckout(");
  assert.ok(assignAt > 0 && legacyAt > assignAt, "fallback deve vir depois do caminho principal");
});
