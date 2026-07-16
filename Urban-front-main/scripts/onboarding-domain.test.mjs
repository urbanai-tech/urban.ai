import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadDomainModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/onboarding/onboarding-domain.ts"),
    "utf8",
  );
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });

  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.deepEqual(errors, []);

  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const domain = await loadDomainModule();

test("extrai identificadores dos formatos Airbnb suportados", () => {
  assert.equal(domain.extractAirbnbPropertyId("https://www.airbnb.com/rooms/123456"), "123456");
  assert.equal(domain.extractAirbnbPropertyId("https://airbnb.com.br/p/998877"), "998877");
  assert.equal(domain.extractAirbnbUserId("https://www.airbnb.com/users/show/445566"), "445566");
  assert.equal(domain.extractAirbnbListingId("https://www.airbnb.com/hosting/listings/editor/778899/details"), "778899");
  assert.equal(domain.extractAirbnbPropertyId("https://example.com/rooms/123456"), null);
  assert.equal(domain.extractAirbnbUserId(""), null);
});

test("normaliza moeda brasileira e rejeita preços inválidos", () => {
  assert.equal(domain.parseMoneyInput("R$ 1.234,56"), 1234.56);
  assert.equal(domain.parseMoneyInput("350,5"), 350.5);
  assert.equal(domain.parseMoneyInput("99.999"), 99999);
  assert.equal(domain.parseMoneyInput("0"), null);
  assert.equal(domain.parseMoneyInput("-20"), null);
  assert.equal(domain.parseMoneyInput("sem preço"), null);
});

test("status de busca progride deterministicamente", () => {
  const status = domain.getOnboardingLoadingStatus("fetching-profile", 2);
  const byId = Object.fromEntries(status.steps.map((step) => [step.id, step.status]));

  assert.equal(status.tone, "accent");
  assert.match(status.title, /2/);
  assert.equal(byId["checking-existing"], "complete");
  assert.equal(byId["fetching-profile"], "active");
  assert.equal(byId["filtering-listings"], "pending");
});

test("fallback manual mantém etapas futuras pendentes", () => {
  const status = domain.getOnboardingLoadingStatus("manual-price-required", 0);
  const byId = Object.fromEntries(status.steps.map((step) => [step.id, step.status]));

  assert.equal(status.tone, "warn");
  assert.equal(byId.daily, "complete");
  assert.equal(byId.manual, "active");
  assert.equal(byId["saving-prices"], "pending");
  assert.equal(byId["starting-analysis"], "pending");
});

test("mensagem de quota usa detalhe da API e preserva fallback genérico", () => {
  assert.equal(
    domain.quotaErrorMessage(
      { response: { data: { code: "LISTINGS_QUOTA_EXCEEDED", message: "Limite do plano" } } },
      "Falha genérica",
    ),
    "Limite do plano",
  );
  assert.equal(domain.quotaErrorMessage(new Error("offline"), "Falha genérica"), "Falha genérica");
});

test("presets preservam estratégia recomendada e modo autônomo sem teto", () => {
  assert.deepEqual(
    { inicial: domain.PRICING_PRESETS.balanced.inicial, final: domain.PRICING_PRESETS.balanced.final },
    { inicial: -10, final: 20 },
  );
  assert.equal(domain.PRICING_PRESETS.autonomous.final, null);
  assert.equal(domain.TOTAL_STEPS, 5);
});
