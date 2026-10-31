import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/publicPlans.ts"), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const mod = await loadModule();

const apiPlans = [
  { name: "starter", isActive: true, priceMonthly: "159", priceQuarterly: "139", priceSemestral: "119", priceAnnualNew: "107" },
  { name: "profissional", isActive: true, priceMonthly: "109", priceQuarterly: "95", priceSemestral: "82", priceAnnualNew: "77" },
  { name: "escala", isActive: true, price: "Sob consulta", isCustomPrice: true },
];

test("lê os preços dos planos da API (mesma matriz do checkout)", () => {
  const pricing = mod.parsePublicPricing(apiPlans);
  assert.equal(pricing.source, "api");
  assert.deepEqual(pricing.starter, { monthly: 159, quarterly: 139, semestral: 119, annual: 107 });
  assert.deepEqual(pricing.profissional, { monthly: 109, quarterly: 95, semestral: 82, annual: 77 });
});

test("resposta incompleta ou fora do formato devolve null (usa o fallback)", () => {
  assert.equal(mod.parsePublicPricing(null), null);
  assert.equal(mod.parsePublicPricing({}), null);
  assert.equal(mod.parsePublicPricing([apiPlans[0]]), null);
  assert.equal(mod.parsePublicPricing([apiPlans[0], { ...apiPlans[1], priceQuarterly: "" }]), null);
  assert.equal(mod.parsePublicPricing([apiPlans[0], { ...apiPlans[1], isActive: false }]), null);
});

test("o fallback preserva os valores publicados antes da fonte única", () => {
  assert.deepEqual(mod.FALLBACK_PUBLIC_PRICING.profissional, { monthly: 99, quarterly: 85, semestral: 72, annual: 67 });
  assert.deepEqual(mod.FALLBACK_PUBLIC_PRICING.starter, { monthly: 149, quarterly: 129, semestral: 109, annual: 97 });
});

test("getPublicPricing sem API configurada ou com falha cai no fallback", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_API_URL;
  try {
    delete process.env.NEXT_PUBLIC_API_URL;
    assert.equal((await mod.getPublicPricing()).source, "fallback");

    process.env.NEXT_PUBLIC_API_URL = "http://api.test/";
    globalThis.fetch = async () => {
      throw new Error("rede");
    };
    assert.equal((await mod.getPublicPricing()).source, "fallback");

    globalThis.fetch = async () => new Response("erro", { status: 500 });
    assert.equal((await mod.getPublicPricing()).source, "fallback");

    let requested = "";
    globalThis.fetch = async (url) => {
      requested = String(url);
      return new Response(JSON.stringify(apiPlans), { status: 200 });
    };
    const pricing = await mod.getPublicPricing();
    assert.equal(requested, "http://api.test/plans");
    assert.equal(pricing.source, "api");
    assert.equal(pricing.profissional.monthly, 109);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalUrl;
  }
});

test("formata preço para a tela (pt-BR) e para o JSON-LD", () => {
  assert.equal(mod.formatPublicPrice(99), "99");
  assert.equal(mod.formatPublicPrice(99.9), "99,90");
  assert.equal(mod.jsonLdPrice(99), "99");
  assert.equal(mod.jsonLdPrice(99.9), "99.90");
});
