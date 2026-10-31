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

const {
  NO_DATA_TEXT,
  describeDelta,
  metricSourceLabel,
  occupancySourceLabel,
  outcomeLabel,
  periodKeyLabel,
  publicReportErrorMessage,
  recentPeriodKeys,
  todayKeySP,
} = await loadModule("src/app/lib/owner-report.ts");

const brl = (value) => `R$ ${value}`;

test("sem comparação o texto explica (nunca zero nem variação inventada)", () => {
  assert.match(describeDelta(null, brl, "agosto de 2026"), /Sem comparação: falta dado em agosto de 2026/);
});

test("variação com sinal explícito, percentual e base do mês anterior", () => {
  const up = describeDelta({ current: 900, previous: 600, delta: 300, deltaPct: 50 }, brl, "agosto de 2026");
  assert.equal(up, "+R$ 300 (+50%) sobre R$ 600 em agosto de 2026.");
  const down = describeDelta({ current: 500, previous: 600, delta: -100, deltaPct: -16.7 }, brl, "agosto de 2026");
  assert.equal(down, "−R$ 100 (−16,7%) sobre R$ 600 em agosto de 2026.");
  const flat = describeDelta({ current: 600, previous: 600, delta: 0, deltaPct: 0 }, brl, "agosto de 2026");
  assert.equal(flat, "Estável: R$ 600 em agosto de 2026.");
  const noPct = describeDelta({ current: 100, previous: 0, delta: 100, deltaPct: null }, brl, "agosto de 2026");
  assert.equal(noPct, "+R$ 100 sobre R$ 0 em agosto de 2026.");
});

test("rótulos de resultado dizem claramente quando não há resultado registrado", () => {
  assert.equal(outcomeLabel("pending"), "Resultado ainda não registrado");
  assert.equal(outcomeLabel("awaiting_event"), "Aguardando o evento");
  assert.equal(outcomeLabel("booked"), "Reservou");
  assert.equal(NO_DATA_TEXT, "Sem dado");
});

test("rótulos de fonte do dado", () => {
  assert.equal(metricSourceLabel(null), null);
  assert.match(metricSourceLabel("recorded_outcomes"), /registrados pelo anfitrião/);
  assert.equal(occupancySourceLabel("stays"), "Stays");
  assert.equal(occupancySourceLabel(null), null);
});

test("mês por extenso e lista dos últimos meses atravessando o ano", () => {
  assert.equal(periodKeyLabel("2026-09"), "setembro de 2026");
  assert.equal(periodKeyLabel("lixo"), "lixo");
  assert.deepEqual(recentPeriodKeys("2026-02-10", 4), ["2026-02", "2026-01", "2025-12", "2025-11"]);
  assert.deepEqual(recentPeriodKeys("sem-data"), []);
});

test("hoje é o dia de São Paulo, não o dia UTC", () => {
  // 01/11 01:30 UTC ainda é 31/10 22:30 em SP.
  assert.equal(todayKeySP(new Date("2026-11-01T01:30:00Z")), "2026-10-31");
  assert.equal(todayKeySP(new Date("2026-11-01T12:00:00Z")), "2026-11-01");
});

test("mensagens da página pública distinguem revogado, expirado, inválido e indisponível", () => {
  assert.equal(publicReportErrorMessage(410, "LINK_REVOKED").title, "Link revogado");
  assert.equal(publicReportErrorMessage(410, "LINK_EXPIRED").title, "Link expirado");
  assert.equal(publicReportErrorMessage(410, null).title, "Link expirado");
  assert.equal(publicReportErrorMessage(404).title, "Link inválido");
  assert.equal(publicReportErrorMessage(429).title, "Muitas tentativas");
  assert.equal(publicReportErrorMessage(null).title, "Não foi possível abrir agora");
  assert.equal(publicReportErrorMessage(503).title, "Não foi possível abrir agora");
});
