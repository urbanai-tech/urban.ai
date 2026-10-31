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

const admin = await loadModule("src/app/admin/event-coverage/reference/reference-domain.ts");
const pub = await loadModule("src/app/(public)/cobertura-de-eventos/coverage-domain.ts");

test("status da referência mapeia para selo e rótulo pt-BR", () => {
  assert.deepEqual(admin.statusMeta("aprovado"), { label: "Aprovada", badge: "success" });
  assert.equal(admin.statusMeta("conflito").badge, "error");
  assert.equal(admin.statusMeta("rejeitado").badge, "neutral");
  assert.equal(admin.statusMeta("candidato").badge, "warn");
  assert.equal(admin.statusMeta("qualquer").label, "Candidata");
});

test("rótulos de validador, veredicto e dimensões", () => {
  assert.equal(admin.validatorLabel("web:sympla.com.br"), "sympla.com.br");
  assert.equal(admin.validatorLabel("web:google-events"), "Google Events (SerpAPI)");
  assert.equal(admin.validatorLabel("db:eventbrite"), "Banco · eventbrite");
  assert.equal(admin.validatorLabel("judge:claude-sonnet-5-5", "judge"), "Juiz · claude-sonnet-5-5");
  assert.equal(admin.verdictLabel("reject"), "Juiz rejeita");
  assert.equal(admin.dimensionValueLabel("size", "grande"), "Grande");
  assert.equal(admin.dimensionValueLabel("category", "sem-categoria"), "Sem categoria");
  assert.equal(admin.dimensionValueLabel("total", "all"), "Todos");
});

test("datas e percentuais não deslocam o dia nem inventam número", () => {
  assert.equal(admin.formatDateKey("2026-11-10"), "10/11/2026");
  assert.equal(admin.formatDateKey("2026-11-10T00:00:00.000Z"), "10/11/2026");
  assert.equal(admin.formatDateKey(null), "—");
  assert.equal(admin.formatPct(null), "—");
  assert.equal(admin.formatPct(66.67), "66,7%");
  assert.equal(admin.formatPct(100), "100%");
});

test("tom do recall compara com o piso", () => {
  assert.equal(admin.recallTone(null, 70), "neutral");
  assert.equal(admin.recallTone(60, 70), "error");
  assert.equal(admin.recallTone(80, 70), "warn");
  assert.equal(admin.recallTone(95, 70), "success");
  assert.equal(admin.recallTone(10, 0), "warn");
});

test("gráfico de recall: ignora dias sem número e fica dentro do viewBox", () => {
  const points = admin.sparkPoints(
    [
      { date: "2026-11-01", recallPast30Pct: null },
      { date: "2026-11-02", recallPast30Pct: 0 },
      { date: "2026-11-03", recallPast30Pct: 50 },
      { date: "2026-11-04", recallPast30Pct: 100 },
    ],
    200,
    100,
  );
  assert.equal(points.length, 3);
  assert.equal(points[0].y, 92);
  assert.equal(points[2].y, 8);
  assert.equal(points[0].x, 8);
  assert.equal(points[2].x, 192);
  assert.equal(admin.sparkPath(points).startsWith("M8 92"), true);
  assert.deepEqual(admin.sparkPoints([], 200, 100), []);
  assert.equal(admin.sparkPoints([{ date: "d", recallPast30Pct: 40 }], 200, 100)[0].x, 100);
  assert.equal(admin.floorY(70, 100), 33.2);
});

test("erros de API viram mensagens úteis", () => {
  assert.equal(admin.normalizeApiError({ response: { status: 403 } }, "x"), "Acesso negado.");
  assert.equal(admin.normalizeApiError({ response: { data: { message: ["a", "b"] } } }, "x"), "a b");
  assert.equal(admin.normalizeApiError({}, "padrão"), "padrão");
});

test("página pública: texto honesto enquanto mede e número só quando medido", () => {
  const measuring = pub.describeCoverage({
    status: "measuring",
    measuredAt: "2026-11-20",
    measuringSince: "2026-11-10",
    daysMeasured: 11,
    minWeeks: 4,
    recallLargeEventsPct: null,
    largeEventsSample: 3,
    eventsTracked: 12,
    venuesCovered: 4,
    message: "Estamos medindo.",
  });
  assert.equal(measuring.headline, "Medição em andamento");
  assert.equal(measuring.recallLabel, "Em medição");
  assert.equal(measuring.progressPct, 39);
  assert.match(measuring.note, /4 semanas/);
  assert.equal(measuring.dateLabel, "20/11/2026");

  const measured = pub.describeCoverage({
    status: "measured",
    measuredAt: "2026-12-01",
    measuringSince: "2026-11-01",
    daysMeasured: 31,
    minWeeks: 4,
    recallLargeEventsPct: 92.4,
    largeEventsSample: 25,
    eventsTracked: 70,
    venuesCovered: 9,
    message: "ok",
  });
  assert.equal(measured.headline, "92,4% dos grandes eventos de São Paulo");
  assert.equal(measured.recallLabel, "92,4%");
  assert.equal(measured.progressPct, 100);

  const empty = pub.describeCoverage(null);
  assert.equal(empty.recallLabel, "Em medição");
  assert.equal(empty.dateLabel, "ainda sem medição");
});

test("página pública: payload inválido não vira número", () => {
  assert.equal(pub.parsePublicCoverage(null), null);
  assert.equal(pub.parsePublicCoverage({ status: "measured" }), null);
  const base = {
    status: "measured",
    measuredAt: "2026-12-01",
    measuringSince: "2026-11-01",
    daysMeasured: 31,
    minWeeks: 4,
    recallLargeEventsPct: 90,
    largeEventsSample: 12,
    eventsTracked: 50,
    venuesCovered: 8,
    message: "x",
  };
  assert.equal(pub.parsePublicCoverage(base).recallLargeEventsPct, 90);
  assert.equal(pub.parsePublicCoverage({ ...base, recallLargeEventsPct: 250 }).recallLargeEventsPct, 100);
  const whileMeasuring = pub.parsePublicCoverage({ ...base, status: "measuring", recallLargeEventsPct: 88 });
  assert.equal(whileMeasuring.recallLargeEventsPct, null);
  assert.equal(whileMeasuring.status, "measuring");
});
