import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule(relativePath) {
  const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const billing = await loadModule("src/app/admin/billing-hosts/billing-hosts-domain.ts");
const outcomes = await loadModule("src/app/admin/outcomes/outcomes-domain.ts");
const aplicar = await loadModule("src/app/dashboard/components/aplicar-preco-domain.ts");

test("billing: texto de trial só para quem está em trial", () => {
  assert.equal(billing.trialText("trialing", 3), "termina em 3 dias");
  assert.equal(billing.trialText("trialing", 1), "termina em 1 dia");
  assert.equal(billing.trialText("trialing", 0), "termina hoje");
  assert.equal(billing.trialText("active", 3), "");
  assert.equal(billing.trialText("trialing", null), "");
});

test("billing: cores por estado (falha = erro, ativo = sucesso, desconhecido = neutro)", () => {
  assert.equal(billing.statusBadgeKind("past_due"), "error");
  assert.equal(billing.statusBadgeKind("active"), "success");
  assert.equal(billing.statusBadgeKind("trial_expired"), "warn");
  assert.equal(billing.statusBadgeKind("qualquer-coisa"), "neutral");
});

test("billing: resumo do plano e 'sem dados' quando não há nada", () => {
  assert.equal(
    billing.planSummary({ planName: "profissional", listingsContratados: 2, billingCycle: "quarterly" }),
    "Profissional · 2 imóveis · trimestral",
  );
  assert.equal(billing.planSummary({ planName: null, listingsContratados: 1, billingCycle: null }), "1 imóvel");
  assert.equal(billing.planSummary({ planName: null, listingsContratados: null, billingCycle: null }), "sem dados");
});

test("billing: datas no calendário de São Paulo e 'sem dados' para vazio ou inválido", () => {
  // 00:30Z de 27/10 ainda é 26/10 em São Paulo.
  assert.equal(billing.formatSaoPauloDate("2026-10-27T00:30:00Z"), "26/10/26");
  assert.equal(billing.formatSaoPauloDate(null), "sem dados");
  assert.equal(billing.formatSaoPauloDate("lixo"), "sem dados");
  assert.match(billing.formatSaoPauloDateTime("2026-10-27T00:30:00Z"), /26\/10\/26.*21:30/);
});

test("billing: rótulo do botão e confirmação dizem exatamente o que será enviado", () => {
  assert.equal(billing.sendLinkLabel("portal", "active"), "Enviar link do portal");
  assert.equal(billing.sendLinkLabel("checkout", "none"), "Enviar link de checkout");
  assert.equal(billing.sendLinkLabel("checkout", "canceled"), "Enviar link para reativar");
  const text = billing.sendLinkConfirmation({ name: "Ana", email: "ana@example.com" }, "portal");
  assert.match(text, /Ana \(ana@example\.com\)/);
  assert.match(text, /portal de cobrança/);
});

test("outcomes: null vira 'sem dados', nunca zero", () => {
  assert.equal(outcomes.formatPrice(null), "sem dados");
  assert.equal(outcomes.formatSignedPercent(undefined), "sem dados");
  assert.equal(outcomes.formatPlainPercent(null), "sem dados");
  assert.equal(outcomes.formatDayKey(null), "sem dados");
  assert.match(outcomes.formatPrice(0), /R\$/); // zero real continua sendo zero
});

test("outcomes: percentual com sinal e preço em reais", () => {
  assert.equal(outcomes.formatSignedPercent(-6.7), "-6,7%");
  assert.equal(outcomes.formatSignedPercent(12), "+12%");
  assert.match(outcomes.formatPrice(1350.5), /1\.350,50/);
  assert.equal(outcomes.formatDayKey("2026-10-24"), "24/10/26");
});

test("outcomes: rótulos de resultado e de 'mais perto'", () => {
  assert.equal(outcomes.outcomeLabel("booked"), "Reservou");
  assert.equal(outcomes.outcomeLabel("xyz"), "Sem dados");
  assert.equal(outcomes.outcomeBadgeKind("not_booked"), "warn");
  assert.equal(outcomes.closerLabel(null), "sem v2");
  assert.equal(outcomes.closerLabel("tie"), "empate");
});

test("outcomes: amostra pequena não afirma nada; só com n suficiente", () => {
  const small = outcomes.sampleBanner(7, 30);
  assert.equal(small.tone, "warn");
  assert.match(small.text, /n = 7/);
  assert.match(small.text, /Sem conclusões/);
  const enough = outcomes.sampleBanner(30, 30);
  assert.equal(enough.tone, "success");
  assert.match(enough.text, /não é teste A\/B/);
});

test("dashboard: título do bloco 'Como foi?' concorda em número", () => {
  assert.equal(aplicar.pendingOutcomesHeading(1), "1 preço que você aplicou está sem resultado");
  assert.equal(aplicar.pendingOutcomesHeading(3), "3 preços que você aplicou estão sem resultado");
  assert.equal(aplicar.pendingOutcomesHeading(-2), "0 preços que você aplicou estão sem resultado");
});
